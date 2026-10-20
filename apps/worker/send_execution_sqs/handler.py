import boto3
import json
from datetime import datetime, timezone, timedelta
import os
import requests
from typing import Dict, List, Any, Optional, Tuple

# Local application imports
import lib.general_utils as utils
from lib.api_utils import CashflowBack

# Constants
TABLE_NAME = "email-reader-crons"

# API Configuration
API_HEADERS = {
    "Content-type": "application/json",
    "Accept": "text/plain",
}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler function to fetch user configurations and send messages to SQS.

    This function:
    1. Determines the execution time from the event or current time
    2. Fetches automation configurations from the database
    3. Transforms the data into SQS message format
    4. Sends messages to the SQS queue for processing

    Args:
        event (Dict[str, Any]): The event data passed to the Lambda function.
            May contain a "time" key to specify the execution time.
        context (Any): The runtime context of the Lambda function.

    Returns:
        Dict[str, Any]: A response object with status code and message:
            {
                "statusCode": int,
                "message": str
            }

    Environment Variables:
        DB_ENDPOINT (str): Database API endpoint URL
        DB_USER (str): Database user email
        DB_PASSWORD (str): Database user password

    Raises:
        KeyError: If required environment variables are missing
        ValueError: If time format is invalid
        Exception: For any other unexpected errors
    """
    try:
        # Load environment variables
        required_env_vars = ["DB_ENDPOINT", "DB_USER", "DB_PASSWORD"]
        for var in required_env_vars:
            if var not in os.environ:
                raise KeyError(f"Missing required environment variable: {var}")

        db_endpoint = os.environ["DB_ENDPOINT"]
        db_user = os.environ["DB_USER"]
        db_password = os.environ["DB_PASSWORD"]
        queue_url = os.environ["QUEUE_URL"]

        print(f"Processing event: {json.dumps(event)}")

        # Determine execution time
        if event.get("time"):
            time = event["time"]
        else:
            # Use America/Bogota timezone (UTC-5) for time calculations
            utc_minus_5 = timezone(timedelta(hours=-5))
            now = datetime.now(utc_minus_5)
            # Round down to the nearest hour for scheduling purposes
            nearest_hour = now.replace(minute=0, second=0, microsecond=0)
            time = nearest_hour.strftime("%H:%M")

        print(f"Fetching automations for time: {time}")

        # Fetch and process automations
        cashflow_client = CashflowBack(
            db_endpoint=db_endpoint,
            admin_mail=db_user,
            admin_password=db_password
        )

        cashflow_client.authenticate()

        data_automations = cashflow_client.list_automations(time)

        if not data_automations:
            print("No automations found.")
            return {"statusCode": 404, "message": "No automations found."}

        # Transform automations into SQS messages
        sqs_messages_list = utils.transform_automations_msgs(data_automations)

        if not sqs_messages_list:
            print("No valid messages to send to SQS.")
            return {"statusCode": 404, "message": "No valid messages to process."}

        # Initialize AWS clients
        session = boto3.Session()
        sqs_client = session.client("sqs")

        # Send messages to SQS
        successful_messages = 0
        for message in sqs_messages_list:
            try:
                sqs_client.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps(message),
                )
                successful_messages += 1
                print(
                    f"Message sent successfully - user_id: {message['user_id']}, "
                    f"user_mail: {message['user_mail']}, "
                    f"sender_email: {message['sender_email']}"
                )
            except Exception as e:
                print(f"Failed to send message for user {message['user_id']}: {str(e)}")
                # Continue processing other messages even if one fails
                continue

        if successful_messages == 0:
            return {
                "statusCode": 500,
                "message": "Failed to send any messages to SQS",
            }

        return {
            "statusCode": 200,
            "message": f"Successfully sent {successful_messages} out of {len(sqs_messages_list)} messages",
        }

    except KeyError as e:
        print(f"Configuration error: {e}")
        raise
    except ValueError as e:
        print(f"Invalid input: {e}")
        raise
    except Exception as e:
        error_message = str(e)
        if "does not exist" in error_message:
            print(f"No automation configured for time {time}")
            raise
        else:
            print(f"Error processing automations: {error_message}")
            raise
