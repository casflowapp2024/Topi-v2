# Standard library imports
from datetime import datetime, timedelta, timezone
import json
import re
from typing import Dict, Any, List, Tuple

# Third-party imports
import boto3
import email
import requests

from botocore.exceptions import ClientError
from google import genai
from google.genai import types


# Standard headers for API requests
API_HEADERS = {
    "Content-type": "application/json",
    "Accept": "text/plain",
}


def transform_automations_msgs(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Transform automation data into a format suitable for SQS messages.

    This function groups related accounts by user email and bank email combinations,
    creating a structured message format for SQS processing.

    Args:
        data (Dict[str, Any]): Raw automation data containing user accounts information.
            Expected format:
            {
                "data": {
                    "user_accounts": {
                        "user_id": [
                            {
                                "id": int,
                                "name": str,
                                "last_four_digits": str,
                                "email_id": int,
                                "user_email": str,
                                "user_provider": str,
                                "sender_email": str,
                                "configured": bool,
                                "time": str
                            }
                        ]
                    }
                }
            }

    Returns:
        List[Dict[str, Any]]: A list of dictionaries containing grouped account information:
            [
                {
                    "user_id": str,
                    "user_mail": str,
                    "email_id": int,
                    "app_password": str,
                    "sender_email": str,
                    "accounts": {
                        "last_four_digits": "account_id"
                    }
                }
            ]

    Raises:
        KeyError: If required data fields are missing
        ValueError: If data structure is invalid
    """
    try:
        result = []
        user_accounts = data.get("data", {}).get("user_accounts", {})

        if not user_accounts:
            print("Warning: No user accounts found in data")
            return result

        for user_id, accounts in user_accounts.items():
            # Dictionary to store accounts grouped by email combination
            grouped_accounts: Dict[Tuple[str, str], Dict[str, Any]] = (
                {}
            )  # todo: change with email_id

            for account in accounts:
                try:
                    # Extract account details
                    user_mail = account["user_email"]
                    email_id = account["email_id"]
                    sender_email = account["sender_email"]
                    user_provider = account["user_provider"]

                    # Create a unique key using tuple of emails to group related accounts
                    group_key = (user_mail, sender_email)

                    # Initialize group if it doesn't exist
                    if group_key not in grouped_accounts:
                        grouped_accounts[group_key] = {
                            "user_id": user_id,
                            "user_mail": user_mail,
                            "email_id": email_id,
                            "user_provider": user_provider,
                            "sender_email": sender_email,
                            "accounts": {},
                        }

                    # Map last four digits to account ID
                    grouped_accounts[group_key]["accounts"][
                        account["last_four_digits"]
                    ] = str(account["id"])
                except KeyError as e:
                    print(f"Warning: Missing required field in account data: {e}")
                    continue

            # Add all grouped accounts to result list
            result.extend(grouped_accounts.values())

        return result

    except Exception as e:
        print(f"Error transforming automation messages: {e}")
        raise


def validate_event(event: Dict[str, Any]) -> dict[str, Any]:
    """
    Validate that the event contains all required fields.

    Args:
        event (Dict[str, Any]): The event data to validate containing:
            - user_id: Unique identifier for the user
            - user_mail: User's email address
            - bank_email: Sender's email address to filter messages
            - accounts: List of account information
            - token: Gmail API authentication token

    Raises:
        ValueError: If any required fields are missing
    """
    body = None

    # Parse event body from SQS message
    if "Records" in event:
        if len(event["Records"]) != 1:
            raise ValueError("Expected exactly one record in SQS event")

        if "body" not in event["Records"][0]:
            raise ValueError("Missing 'body' key in SQS event record")

        body = event["Records"][0]["body"]
    # Parse event body from API Gateway event
    elif "body" in event:
        body = event.get("body")
    else:
        raise ValueError("The request event is not valid")

    if isinstance(body, str):
        body = json.loads(body.replace("'", '"'))

    required_fields = [
        "user_id",
        "user_mail",
        "email_id",
        "user_provider",
        "sender_email",
        "accounts",
    ]

    missing_fields = [field for field in required_fields if field not in body]
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

    return body


def get_last_run(
    table_name: str, user_email: str, bank_email: str
) -> Tuple[str, datetime]:
    """
    Retrieve the timestamp of the last email processing run for a specific bank from DynamoDB.

    This function manages the last run timestamp for each bank's email processing:
    - If no record exists, creates a new one starting from the first day of current month
    - If record exists but no bank entry, adds the bank with first day of current month
    - If bank entry exists, returns the stored timestamp

    Args:
        table_name (str): Name of the DynamoDB table storing the last run information
        user_email (str): User's email address used as primary key
        bank_email (str): Bank's email address used as key in last_runs map

    Returns:
        Tuple[str, datetime]: A tuple containing:
            - filter_date (str): Date formatted as 'YYYY-MM-DD' for IMAP filtering
            - last_run (datetime): The last run datetime object in UTC-5 timezone

    Note:
        DynamoDB Item structure:
        {
            "user_mail": str,
            "last_runs": {
                "bank_email1": "YYYY-MM-DD HH:MM:SS.fff",
                "bank_email2": "YYYY-MM-DD HH:MM:SS.fff"
            }
        }
    """
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table = dynamodb.Table(table_name)
    utc_minus_5 = timezone(timedelta(hours=-5))
    format_filter_date = "%Y-%m-%d"

    try:
        # Get existing record from DynamoDB
        response = table.get_item(Key={"user_mail": user_email})

        # Set default timestamp to first day of current month
        now = datetime.now(utc_minus_5).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        first_run = now.strftime("%Y-%m-%d %H:%M:%S.%f")

        if "Item" in response:
            if bank_email in response["Item"]["last_runs"]:
                # Use existing timestamp for this bank
                last_run = datetime.strptime(
                    response["Item"]["last_runs"][bank_email], "%Y-%m-%d %H:%M:%S.%f"
                ).replace(tzinfo=utc_minus_5)
                filter_date = last_run.strftime(format_filter_date)
            else:
                # Add new bank entry with first day of month
                table.update_item(
                    Key={"user_mail": user_email},
                    UpdateExpression="SET last_runs.#bank_email = :last_runs",
                    ExpressionAttributeNames={"#bank_email": bank_email},
                    ExpressionAttributeValues={":last_runs": first_run},
                )
                filter_date = now.strftime(format_filter_date)
                last_run = now
        else:
            # Create new record with first day of month
            table.put_item(
                Item={"user_mail": user_email, "last_runs": {bank_email: first_run}}
            )
            filter_date = now.strftime(format_filter_date)
            last_run = now

        return filter_date, last_run

    except ClientError as e:
        print(f"Error accessing DynamoDB: {e.response['Error']['Message']}")
        raise


def check_new_emails(email_data: Dict[str, Any], last_run: datetime) -> bool:
    """
    Check if an email is newer than the last run timestamp.

    Args:
        email_data (Dict[str, Any]): Email data containing:
            - date (str): Email date in format "YYYY-MM-DD HH:MM:SS %z"
        last_run (datetime): Timestamp of last processing run

    Returns:
        bool: True if email is newer than last_run, False otherwise
    """
    email_date = datetime.strptime(email_data["date"], "%Y-%m-%d %H:%M:%S %z")
    if email_date < last_run:
        return False
    return True


def normalize_date_to_utc(date_str: str) -> str:
    """
    Normalize different email date formats to UTC+0.

    Args:
        date_str (str): Date string in RFC2822 format with timezone or ISO 8601 format
            Supports formats like:
            - "Mon, 28 Apr 2025 15:29:11 +0000" (RFC2822)
            - "Mon, 28 Apr 2025 11:40:09 -0500 (COT)" (RFC2822)
            - "2025-06-15T06:38:21Z" (ISO 8601)

    Returns:
        str: Normalized date string in format "YYYY-MM-DD HH:MM:SS %z"

    Raises:
        ValueError: If date string cannot be parsed
    """
    # Check if it's ISO 8601 format (contains 'T' separator and follows ISO 8601 pattern)
    # ISO 8601 format: YYYY-MM-DDTHH:MM:SS[.fff][Z|±HH:MM]
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", date_str):
        try:
            # Handle ISO 8601 format
            if date_str.endswith("Z"):
                # UTC timezone
                parsed_date = datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
                utc_date = parsed_date.replace(tzinfo=timezone.utc)
            else:
                # Parse ISO 8601 with timezone offset
                parsed_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                utc_date = parsed_date.astimezone(timezone.utc)
            return utc_date.strftime("%Y-%m-%d %H:%M:%S %z")
        except Exception as e:
            raise ValueError(f"Could not parse ISO 8601 date string: {date_str}") from e

    # Handle RFC2822 format (existing logic)
    clean_date = date_str.split("(")[0].strip()

    try:
        parsed_date = email.utils.parsedate_to_datetime(clean_date)
        utc_date = parsed_date.astimezone(timezone.utc)
        return utc_date.strftime("%Y-%m-%d %H:%M:%S %z")
    except Exception as e:
        raise ValueError(f"Could not parse date string: {date_str}") from e


def parse_amount(amount_str: str) -> float:
    """
    Parse a string containing a monetary amount into a float value.

    This function handles various currency formats:
    - English format: "820,892.18"
    - Spanish format: "820.892,18"
    - No thousand separator: "820892.18", "820892,18"
    - Consistent separators: "820.892.18", "820,892,18"
    - Spanish without decimal: "7.347"

    Args:
        amount_str (str): String containing the monetary amount

    Returns:
        float: Parsed monetary amount

    Raises:
        ValueError: If the string cannot be converted to a float
    """
    try:
        # Remove any non-numeric characters except decimal and thousand separators
        amount_str = amount_str.strip()
        clean_input = re.sub(r"[^\d.,]", "", amount_str)

        if not clean_input:
            return 0.0

        # Handle case with no separators
        if "," not in clean_input and "." not in clean_input:
            return float(clean_input)

        # Handle special case: single separator with exactly 3 digits after
        if (
            clean_input.count(".") == 1
            and len(clean_input.split(".")[-1]) == 3
            and "," not in clean_input
        ):
            return float(clean_input.replace(".", ""))
        if (
            clean_input.count(",") == 1
            and len(clean_input.split(",")[-1]) == 3
            and "." not in clean_input
        ):
            return float(clean_input.replace(",", ""))

        # Find the last separator to determine decimal point
        last_comma_pos = clean_input.rfind(",")
        last_point_pos = clean_input.rfind(".")

        # Parse based on the last separator
        if last_comma_pos > last_point_pos:
            parts = clean_input.rsplit(",", 1)
            integer_part = parts[0].replace(".", "").replace(",", "")
            decimal_part = parts[1] if len(parts) > 1 else ""
        else:
            parts = clean_input.rsplit(".", 1)
            integer_part = parts[0].replace(".", "").replace(",", "")
            decimal_part = parts[1] if len(parts) > 1 else ""

        # Combine parts into final number
        if decimal_part:
            return float(f"{integer_part}.{decimal_part}")
        return float(integer_part)

    except ValueError as ve:
        if "could not convert string to float:" in str(ve):
            return 0.0
        raise ve
    except Exception as e:
        raise ValueError(f"Could not convert value '{amount_str}' to float.") from e


def send_gemini_request(
    messages: List[Dict[str, str]], api_key: str, prompt: str
) -> List[Dict[str, Any]]:
    """
    Process email contents through Google's Gemini API to extract transaction information.

    This function:
    1. Initializes Gemini API client
    2. Processes each email through the API
    3. Parses the response to extract transaction details
    4. Validates and formats the extracted data

    Args:
        messages (List[Dict[str, str]]): List of dictionaries containing email data:
            - processed_content (str): The email body content
            - date (str): Email date in format "YYYY-MM-DD HH:MM:SS %z"
        api_key (str): Google Gemini API key

    Returns:
        List[Dict[str, Any]]: List of transactions, each containing:
            - account_number (str): Last 4 digits of account
            - description (str): Transaction description
            - expense (bool): Whether it's an expense
            - amount (float): Transaction amount
            - date (str): Transaction date in YYYY-MM-DD format

    Raises:
        Exception: If there's an error in the Gemini API request or response parsing
    """
    transactions = []
    client = genai.Client(api_key=api_key)

    for item in messages:
        email_data = item["body"]
        try:
            # Send request to Gemini API
            response = client.models.generate_content(
                # model="gemini-2.5-flash-preview-04-17",
                #model="gemini-2.5-flash-lite-preview-06-17",
                model ="gemini-2.0-flash",
                config=types.GenerateContentConfig(system_instruction=prompt),
                contents=email_data,
            )

            # Parse JSON response
            response_text = response.text.replace("```json\n", "").replace("\n```", "")
            transaction_data = json.loads(response_text)
            transaction_data["date"] = item["date"]

            # Validate and process transaction data
            if "transaction_detected" not in transaction_data:
                if "amount" in transaction_data:
                    transaction_data["amount"] = parse_amount(
                        str(transaction_data["amount"])
                    )
                if transaction_data["amount"] != 0:
                    transactions.append(transaction_data)

        except Exception as e:
            print(f"Error processing Gemini request: {e}")
            raise

    return transactions


def map_account_ids(
    transactions: List[Dict[str, Any]], accounts: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Map account IDs from the accounts dictionary to each transaction.

    This function:
    1. Validates input data
    2. Maps account numbers to their corresponding IDs
    3. Handles cases where account number is not found
    4. Adds verification flag for unmatched accounts

    Args:
        transactions (List[Dict[str, Any]]): List of transactions to process
        accounts (Dict[str, str]): Dictionary mapping account numbers to IDs

    Returns:
        List[Dict[str, Any]]: Updated transactions with account IDs

    Raises:
        ValueError: If transactions list or accounts dictionary is empty
    """
    if not transactions or not accounts:
        raise ValueError("Empty transactions list or accounts dictionary")

    for transaction in transactions:
        try:
            account_number = transaction.get("account_number")
            if accounts.get(account_number):
                transaction["account_id"] = int(accounts.get(account_number))
            else:
                # Use first available account if no match found
                transaction["account_id"] = int(next(iter(accounts.values())))
                transaction["should_verify"] = True
        except (ValueError, TypeError) as e:
            print(f"Error processing transaction: {e}")
            transaction["error"] = str(e)
            continue

    return transactions


def update_last_run(
    table_name: str, user_email: str, bank_email: str, time_updated: datetime
) -> None:
    """
    Update the timestamp of the last email processing run for a specific bank in DynamoDB.

    This function updates the last run timestamp for a specific bank in the user's record,
    maintaining the history of when each bank's emails were last processed.

    Args:
        table_name (str): Name of the DynamoDB table storing the last run information
        user_email (str): User's email address used as primary key
        bank_email (str): Bank's email address used as key in last_runs map
        time_updated (datetime): The new timestamp to store

    Raises:
        ClientError: If there's an error updating the DynamoDB table
    """
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    try:
        table.update_item(
            Key={"user_mail": user_email},
            UpdateExpression="SET last_runs.#bank_email = :last_run",
            ExpressionAttributeNames={"#bank_email": bank_email},
            ExpressionAttributeValues={":last_run": time_updated},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        print(f"Error updating DynamoDB: {e.response['Error']['Message']}")
        raise


def save_dataframe_to_s3_with_glue(
    data: List[Dict[str, Any]],
    user_id: str,
    sender_email: str,
    env: str,
) -> Dict[str, str]:
    """
    Convert an array of dictionaries to a pandas DataFrame, add UTC timestamp,
    and save it to S3 using AWS Data Wrangler with Glue catalog integration.

    This function:
    1. Converts the input array of dictionaries to a pandas DataFrame
    2. Adds a 'time_processing' column with current UTC timestamp
    3. Saves the DataFrame to S3 in Parquet format
    4. Registers the data in AWS Glue Data Catalog

    Args:
        data (List[Dict[str, Any]]): Array of dictionaries to convert to DataFrame
        user_id (str): User ID for the transactions
        sender_email (str): Sender email for the transactions

    Returns:
        Dict[str, str]: Response containing status and message with S3 path

    Raises:
        ValueError: If input data is empty or invalid
        Exception: If there's an error saving to S3 or updating Glue catalog
    """
    import pandas as pd
    import awswrangler as wr

    try:
        if not data:
            raise ValueError("Input data cannot be empty")

        # Convert array of dictionaries to pandas DataFrame
        df = pd.DataFrame(data)

        # Drop columns that are not needed
        df = df.drop(columns=["subject", "sender"])

        # Rename columns
        df = df.rename(
            columns={"id": "message_id", "date": "message_date", "body": "message_body"}
        )

        df["user_id"] = user_id
        df["sender_email"] = sender_email

        # Add UTC timestamp column
        df["time_processing"] = pd.Timestamp.now(tz="UTC")
        df["date_processing"] = pd.to_datetime(df["time_processing"]).dt.strftime(
            "%Y-%m-%d"
        )
        # Generate S3 path with timestamp for uniqueness
        timestamp = datetime.now().strftime("%Y/%m/%d/%H")
        s3_path = f"s3://cashflow-saturn-bucket-{env}/saturn_transactions"

        partition_cols = ["user_id", "sender_email", "date_processing"]

        # Save DataFrame to S3 using AWS Data Wrangler
        wr.s3.to_parquet(
            df=df,
            path=s3_path,
            dataset=True,
            database="saturn",
            table="saturn_transactions",
            partition_cols=partition_cols,
            mode="append",
            compression="snappy",
        )

        print(f"DataFrame successfully saved to S3: {s3_path}")

        return {
            "status": "success",
            "message": f"DataFrame saved successfully to {s3_path}",
            "s3_path": s3_path,
            "rows_processed": len(df),
            "columns": list(df.columns),
        }

    except ValueError as ve:
        print(f"ValueError in save_dataframe_to_s3_with_glue: {ve}")
        return {"status": "error", "message": str(ve)}
    except Exception as e:
        print(f"Error saving DataFrame to S3: {str(e)}")
        return {"status": "error", "message": str(e)}
