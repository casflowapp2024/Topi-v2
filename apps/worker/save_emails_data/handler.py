from typing import Dict, List, Any, Optional
import os
import json

# Local application imports
import lib.general_utils as utils


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler function for saving email data to S3 with Glue catalog integration.

    This function processes SQS messages containing email data and saves the extracted
    transaction information to S3 using the Glue catalog for metadata management.

    Args:
        event (Dict[str, Any]): AWS Lambda event object containing SQS message records.
                               Expected format: {"Records": [{"body": {...}}]}
        context (Any): AWS Lambda context object (unused but required by Lambda interface)

    Returns:
        Dict[str, Any]: Response from the S3 save operation, typically containing
                        success status and S3 location information

    Raises:
        ValueError: When the event body cannot be parsed as valid JSON
        Exception: For any other unexpected errors during processing

    Example event structure:
        {
            "Records": [{
                "body": {
                    "emails_data": [...],      # List of extracted email transaction data
                    "user_id": "user123",      # Unique identifier for the user
                    "sender_email": "sender@example.com"  # Email address of the sender
                }
            }]
        }
    """
    print(f"Event: {event}")

    try:
        env = os.environ["ENV"]
        # Parse event body from SQS message
        # SQS messages are wrapped in Records array, we take the first record
        body = event["Records"][0]["body"]

        # Handle case where body might be a string that needs JSON parsing
        # Replace single quotes with double quotes for valid JSON format
        if isinstance(body, str):
            body = json.loads(body.replace("'", '"'))

        # Extract required data from the parsed event body
        emails_data = body["emails_data"]  # List of extracted email transactions
        user_id = body["user_id"]  # User identifier for data organization
        sender_email = body["sender_email"]  # Sender email for categorization

        # Save the extracted transaction data to S3 with Glue catalog integration
        # This function handles the actual data persistence and metadata management
        return utils.save_dataframe_to_s3_with_glue(emails_data, user_id, sender_email, env)

    except ValueError as e:
        # Handle JSON parsing errors or malformed data
        print(f"ValueError: {str(e)}")
        raise
    except Exception as e:
        # Catch any other unexpected errors and log them before re-raising
        print(f"Unexpected error: {str(e)}")
        raise
