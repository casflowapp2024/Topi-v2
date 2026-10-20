from typing import Dict, Any
import os
import json
import boto3

# Third-party imports
from googleapiclient.errors import HttpError

# Local application imports
import lib.api_utils as api_utils
import lib.general_utils as utils
import lib.google_utils as google_utils
import lib.microsoft_utils as microsoft_utils
from lib.gemini import Gemini
from lib.api_utils import CashflowBack
from prompt_v3 import prompt


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """AWS Lambda handler function to process Gmail messages and extract transaction data.

    This function:
    1. Authenticates with Gmail API
    2. Retrieves new emails from a specified sender
    3. Processes email content to extract transaction data
    4. Sends transaction data to the database
    5. Updates last run timestamp

    Args:
        event (Dict[str, Any]): AWS Lambda event containing:
            - Records[0].body: JSON string with:
                - user_id: Unique identifier for the user
                - user_mail: User's email address
                - email_id: Email ID
                - user_provider: User provider
                - sender_email: Sender's email address to filter messages
                - accounts: List of account information

    Returns:
        Dict[str, Any]: Response with status code and message:
            - statusCode: HTTP status code (200 for success)
            - body: JSON response with a message

    Raises:
        ValueError: If required fields are missing in the event
        HttpError: If there's an error with the Gmail API
        Exception: For other unexpected errors
    """
    print(f"Event: {event}")

    # Initialize variables
    email_id = None
    user_id = None
    onboarding = False
    env_vars = {}
    cashflow_client = None
    email_read = False

    try:
        # Load required environment variables
        required_env_vars = [
            "OPENAI_API_KEY",
            "GEMINI_API_KEY",
            "DB_USER",
            "DB_PASSWORD",
            "DB_ENDPOINT",
            "GMAIL_CLIENT_ID",
            "GMAIL_CLIENT_SECRET",
            "GMAIL_TOKEN_URI",
            "OUTLOOK_CLIENT_ID",
            "OUTLOOK_CLIENT_SECRET",
            "OUTLOOK_TOKEN_URI",
            "SQS_QUEUE_URL",
        ]

        for var in required_env_vars:
            if var not in os.environ:
                raise ValueError(f"Missing required environment variable: {var}")
            env_vars[var] = os.environ[var]

        # Validate required fields in the event
        body = utils.validate_event(event)

        # Extract required data from event
        user_id = body.get("user_id")
        user_email = body.get("user_mail")
        email_id = body.get("email_id")
        user_provider = body.get("user_provider")
        sender_email = body.get("sender_email")
        accounts = body.get("accounts")
        onboarding = body.get("onboarding", False)

        # DynamoDB table name for tracking last run timestamps
        dynamo_table_last_run = "saturn-last-run"

        # Get the last run timestamp and filter date for message retrieval
        filter_date, last_run = utils.get_last_run(
            dynamo_table_last_run, user_email, sender_email
        )

        # Initialize CashflowBack client
        cashflow_client = CashflowBack(
            db_endpoint=env_vars["DB_ENDPOINT"],
            admin_mail=env_vars["DB_USER"],
            admin_password=env_vars["DB_PASSWORD"]
        )

        cashflow_client.authenticate()

        email_tokens = cashflow_client.get_email_tokens(
            user_id,
            email_id,
        )

        # TODO: Add provider conditionals
        email_service = None
        if user_provider == "gmail":
            # Initialize Gmail API service
            email_service = google_utils.GmailService(email_tokens, env_vars)

        elif user_provider == "outlook":
            email_service = microsoft_utils.OutlookService(email_tokens, env_vars)

        emails_data, last_run_update = email_service.get_emails(
            sender_email,
            filter_date,
            last_run,
        )

        # Update email read status
        email_read = True

        # Return early if no new emails after filtering
        if not emails_data:
            print("No new emails found.")
            return {
                "statusCode": 204,
                "body": {"message": "No new emails found."},
            }

        print(f"Found {len(emails_data)} new emails")

        # Send data to a sqs queue
        # Send emails data to the SQS queue for further processing
        sqs_message_body = {
            "emails_data": emails_data,
            "user_id": user_id,
            "sender_email": sender_email,
        }

        sqs = boto3.client("sqs")
        if env_vars["SQS_QUEUE_URL"]:
            try:
                response = sqs.send_message(
                    QueueUrl=env_vars["SQS_QUEUE_URL"],
                    MessageBody=json.dumps(sqs_message_body),
                )
                print(
                    f"Successfully sent message to SQS. MessageId: {response['MessageId']}"
                )
            except Exception as e:
                print(f"Failed to send message to SQS: {str(e)}")
        else:
            print("Warning: SQS_QUEUE_URL not found in environment variables")

        # Use Gemini API to extract transaction data from emails
        gemini = Gemini(
            api_key=env_vars["GEMINI_API_KEY"],
            prompt=prompt,
        )

        transactions = gemini.process_messages(emails_data)

        if not transactions:
            print("No transactions emails found after Gemini API request")
            return {
                "statusCode": 200,
                "body": {"message": "No transactions found."},
            }

        # Map account IDs to transactions
        transactions = utils.map_account_ids(transactions, accounts)
        print(f"Processed transactions: {json.dumps(transactions)}")

        # Store transactions in the database
        cashflow_client.send_txn_to_db(
            user_id,
            transactions,
        )

        # Update the last run timestamp in DynamoDB
        utils.update_last_run(
            dynamo_table_last_run,
            user_email,
            sender_email,
            last_run_update,
        )

        return {
            "statusCode": 200,
            "body": {
                "message": f"Successfully processed {len(emails_data)} emails",
                "transactions_processed": len(transactions),
            },
        }

    except ValueError as e:
        print(f"ValueError: {str(e)}")
        if cashflow_client:
            print(
                cashflow_client.send_user_error(
                    email_id,
                    str(e),
                )
            )
        raise Exception("ValueError")

    except HttpError as e:
        print(f"Gmail API error: {str(e)}")
        if cashflow_client:
            print(
                cashflow_client.send_user_error(
                    email_id,
                    str(e),
                )
            )
        raise Exception("Gmail API error")

    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        if cashflow_client:
            print(
                cashflow_client.send_user_error(
                    email_id,
                    str(e),
                )
            )
        raise Exception("Unexpected error")

    finally:
        # If the request comes from onboarding, confirm the email read
        if onboarding and user_id and email_read:
            cashflow_client.confirm_email_read(user_id)
