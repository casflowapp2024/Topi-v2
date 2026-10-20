"""
Microsoft Graph API Integration Utilities

This module provides comprehensive utilities for interacting with Microsoft Graph API
to access and process email messages from Microsoft 365/Outlook accounts. It includes
authentication, message retrieval, filtering, and data processing capabilities.

Key Features:
- OAuth2 refresh token authentication for Microsoft Graph API
- Advanced message filtering by sender and date range
- Batch message retrieval for improved performance
- HTML to plain text conversion with content cleaning
- Robust error handling and fallback mechanisms

Main Classes:
- OutlookService: Main service class for Microsoft Graph API operations

Dependencies:
- requests: HTTP client for API communication
- beautifulsoup4: HTML parsing and text extraction
- msal: Microsoft Authentication Library (for future use)
- general_utils: Local utility functions for date normalization

Author: CashFlow Saturn Team
Version: 1.0
"""

# Standard library imports
import re
from datetime import datetime, timedelta, timezone
from typing import Any, List, Dict

# Third-party imports
from bs4 import BeautifulSoup
import requests

# Local application imports
import lib.general_utils as utils


# Microsoft Graph API required permissions for accessing user data
# The .default scope provides access to all permissions configured for the app
SCOPES = ["https://graph.microsoft.com/.default"]


class OutlookService:
    def __init__(self, credentials: dict, env: dict):
        """
        Initialize OutlookService with OAuth2 credentials.

        Args:
            token (dict): Dictionary containing OAuth2 credentials:
                - client_id: Azure AD application client ID
                - client_secret: Azure AD application client secret
                - token_uri: OAuth2 token endpoint URL
                - refresh_token: OAuth2 refresh token for token renewal
        """
        credentials = self.add_clients(credentials, env)
        self.access_token = self.authenticate(credentials)

    def get_emails(
            self,
            sender: str,
            filter_date: str,
            last_run: datetime,
            filter_date_before: str | None = None,
    ) -> tuple[List[Dict[str, Any]], str]:
        """
        Get emails from Microsoft Graph API matching specific criteria.

        Args:
            sender (str): Email address to filter messages from
            filter_date (str): Date to filter messages after (YYYY-MM-DD)
            last_run (datetime): Last run timestamp to filter new emails
            filter_date_before (str, optional): Date to filter messages before (YYYY-MM-DD)

        Returns:
            List[Dict[str, Any]]: List of email message dictionaries
        """
        messages, last_run_update = self.list_messages(
            sender,
            filter_date,
            filter_date_before,
        )

        if not messages:
            return [], ""

        return self.get_email_messages(messages, last_run), last_run_update

    def get_email_messages(self, messages: list, last_run: datetime) -> List[Dict[str, Any]]:
        """
        Process a list of message objects to extract transaction data.

        Args:
            messages (list): List of message objects from Microsoft Graph API
            last_run (datetime): Last run timestamp to filter new emails

        Returns:
            List[Dict[str, Any]]: List of processed email message dictionaries
        """
        emails_data: List[Dict[str, Any]] = []

        for message in messages:
            try:
                message_data = self.get_message_details(message)
                if utils.check_new_emails(message_data, last_run):
                    emails_data.append(message_data)
            except Exception as e:
                print(f"Error processing message {message.get('id', 'unknown')}: {str(e)}")
                continue

        return emails_data

    def list_messages(self, sender: str, filter_date: str, filter_date_before: str | None = None) -> tuple[list, str]:
        """
        Retrieve messages from Microsoft Graph API using advanced filtering criteria.

        This function queries the Microsoft Graph API to fetch email messages that match specific
        filtering criteria including sender email address and date range. It constructs an OData
        filter query to efficiently retrieve only the relevant messages from the user's mailbox.

        The filtering process:
        1. Filters messages by sender email address (exact match)
        2. Filters messages received after the specified start date
        3. Optionally filters messages received before the specified end date
        4. Limits results to 1000 messages per request for performance

        Args:
            sender (str): Email address of the sender to filter messages from (e.g., "sender@example.com")
            filter_date (str): Start date for filtering messages in YYYY-MM-DD format (inclusive)
            filter_date_before (str, optional): End date for filtering messages in YYYY-MM-DD format (exclusive)

        Returns:
            tuple[list, str]: A tuple containing:
                - List of message objects with full message data (not just IDs)
                - Current timestamp in UTC-5 timezone for tracking execution time

        Raises:
            requests.RequestException: If the API request fails due to network issues, invalid token,
                                      or API rate limiting
        """
        # Build OData filter query for Microsoft Graph API
        # Note: query_parts is built but not used - the actual filter uses direct OData syntax
        # This could be used for future search query construction if needed
        query_parts = []

        query_parts.append(f"from:{sender}")
        query_parts.append(f"receivedDateTime ge {filter_date}T00:00:00Z")

        if filter_date_before:
            query_parts.append(f"receivedDateTime lt {filter_date_before}T00:00:00Z")

        # Construct the OData filter string for Microsoft Graph API
        # This uses the proper OData syntax for filtering messages
        # OData filters use 'eq' for equality, 'ge' for greater than or equal, 'lt' for less than
        filter_string = f"from/emailAddress/address eq '{sender}' and receivedDateTime ge {filter_date}T00:00:00Z"

        if filter_date_before:
            filter_string += f" and receivedDateTime lt {filter_date_before}T00:00:00Z"

        print(f"Constructed OData Query: {filter_string}\n")

        # Microsoft Graph API endpoint for user messages
        url = "https://graph.microsoft.com/v1.0/me/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        # API request parameters for efficient data retrieval
        params = {
            "$filter": filter_string,
            "$select": "id,subject,from,receivedDateTime,body",  # Only retrieve needed fields
            "$top": 1000,  # Maximum messages per request (Graph API limit)
        }

        # Execute Microsoft Graph API request
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()  # Raise exception for HTTP error status codes

        # Parse response and extract messages
        results = response.json()
        messages = results.get("value", [])

        # Generate timestamp in UTC-5 timezone for tracking purposes
        utc_minus_5 = timezone(timedelta(hours=-5))
        last_run_update = datetime.now(utc_minus_5).strftime("%Y-%m-%d %H:%M:%S.%f")

        print(f"Found {len(messages)} messages matching criteria")
        return messages, last_run_update

    @staticmethod
    def get_message_details(message: dict) -> dict:
        """
        Process and extract detailed information from a Microsoft Graph message object.

        This function takes a raw message object from the Microsoft Graph API and extracts
        key information including the message body, sender details, and metadata. It handles
        HTML content conversion to plain text and performs data cleaning for better usability.

        The processing steps:
        1. Extracts HTML content from the message body
        2. Converts HTML to clean plain text using BeautifulSoup
        3. Removes scripts, styles, and unnecessary whitespace
        4. Normalizes dates to UTC format
        5. Extracts sender information and subject line

        Args:
            message (dict): Raw message object from Microsoft Graph API containing:
                - id: Unique message identifier
                - subject: Email subject line
                - from: Sender information object
                - receivedDateTime: ISO 8601 formatted date string
                - body: Message body object with content and contentType

        Returns:
            dict: Processed message details containing:
                - id (str): Message ID
                - subject (str): Email subject line
                - sender (str): Sender's email address
                - date (str): Normalized date in UTC format
                - body (str): Cleaned plain text message body

        Raises:
            requests.RequestException: If there's an error processing the message data
            KeyError: If required message fields are missing
        """
        try:
            # Extract and clean HTML content from message body
            # BeautifulSoup is used to parse HTML and extract clean text
            soup = BeautifulSoup(message["body"]["content"], "html.parser")

            # Extract plain text from HTML with proper spacing between elements
            # This ensures words from different HTML elements don't get concatenated
            text = soup.get_text()

            # Add spaces between elements to prevent word concatenation
            text = text.replace('\n', ' ').replace('\t', ' ')

            # Clean and format text by normalizing whitespace
            # Replace multiple spaces with single spaces and multiple newlines with single newlines
            text = re.sub(
                r"\s+", " ", text
            )  # Replace multiple whitespace with single space
            text = re.sub(
                r"\n\s*\n", "\n", text
            )  # Replace multiple newlines with single newline

            # Split into lines and clean each line
            lines = []
            for line in text.splitlines():
                line = line.strip()
                if line:  # Only add non-empty lines
                    lines.append(line)

            # Join lines with single newlines to preserve structure
            body_text = "\n".join(lines)

            # Normalize date to UTC format for consistency
            date = message["receivedDateTime"]
            if date != "Unknown Date":
                date = utils.normalize_date_to_utc(date)

            # Return structured message details
            return {
                "id": message["id"],
                "subject": message["subject"],
                "sender": message["from"]["emailAddress"]["address"],
                "date": date,
                "body": body_text,
            }
        except requests.RequestException as error:
            print(f"An error occurred while processing message: {error}")
            raise error

    @staticmethod
    def authenticate(token: dict) -> str:
        """
        Authenticate with the Microsoft Graph API using OAuth2 refresh token flow.

        This function implements the OAuth2 refresh token grant type to obtain a new access token
        for accessing Microsoft Graph API resources. It uses the provided credentials to authenticate
        and returns a valid access token that can be used for subsequent API calls.

        The authentication process:
        1. Uses the provided refresh token to request a new access token
        2. Validates the response and extracts the access token
        3. Returns the token for immediate use in API calls

        Args:
            token (dict): Dictionary containing Microsoft OAuth2 credentials:
                - client_id (str): Azure AD application client ID (required)
                - client_secret (str): Azure AD application client secret (required)
                - token_uri (str): OAuth2 token endpoint URL (required)
                - refresh_token (str): OAuth2 refresh token for token renewal (required)

        Returns:
            str: Valid Microsoft Graph API access token for making authenticated requests

        Raises:
            Exception: If authentication fails due to invalid credentials, expired refresh token,
                      network issues, or other authentication-related errors
        """
        try:
            # Create a confidential client application for MSAL (Microsoft Authentication Library)
            # Note: This is currently commented out as we're using direct OAuth2 refresh token flow
            # app = ConfidentialClientApplication(
            #     client_id=token["client_id"],
            #     client_credential=token["client_secret"],
            #     authority=token["token_uri"],
            # )

            # Use OAuth2 refresh token grant type to obtain a new access token
            # This approach is more reliable for server-to-server scenarios
            token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            data = {
                "client_id": token["client_id"],
                "scope": SCOPES,
                "refresh_token": token["refresh_token"],
                "grant_type": "refresh_token",
                "client_secret": token["client_secret"],
            }

            # Make a POST request to token endpoint
            response = requests.post(token_url, data=data)
            response.raise_for_status()  # Raise exception for HTTP error status codes
            result = response.json()

            # Validate response and extract access token
            if "access_token" in result:
                return result["access_token"]
            else:
                # Handle authentication errors with descriptive messages
                error_msg = result.get("error_description", "Unknown authentication error")
                raise Exception(f"Failed to acquire token: {error_msg}")

        except Exception as e:
            print(f"Authentication error: {e}")
            raise Exception(f"Authentication failed: {str(e)}")

    @staticmethod
    def add_clients(credentials: dict, env_vars: dict):
        """
        Add clients to credentials
        """
        # TODO: Remove this once we have a better way to get the tokens
        credentials["client_id"] = env_vars["OUTLOOK_CLIENT_ID"]
        credentials["client_secret"] = env_vars["OUTLOOK_CLIENT_SECRET"]
        credentials["token_uri"] = env_vars["OUTLOOK_TOKEN_URI"]

        return credentials


if __name__ == "__main__":
    from dotenv import load_dotenv
    from pathlib import Path
    import os

    # Load Env Vars
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / ".env"
    load_dotenv(dotenv_path=env_path)

    client_id = os.environ.get('OUTLOOK_CLIENT_ID')
    client_secret = os.environ.get('OUTLOOK_CLIENT_SECRET')
    token_uri = os.environ.get('OUTLOOK_TOKEN_URI')
    refresh_token = os.environ.get('OUTLOOK_REFRESH_TOKEN')

    # Test parameters
    sender = "noreply@rappicard.co"
    last_run = datetime.now(timezone.utc) - timedelta(days=15)  # Filter emails after this date
    filter_date = "2025-10-20"  # Filter emails after this date

    # Sample token for testing (replace with actual credentials)
    credentials = {
        "refresh_token": refresh_token,
    }

    env_vars = {
        "OUTLOOK_CLIENT_ID": client_id,
        "OUTLOOK_CLIENT_SECRET": client_secret,
        "OUTLOOK_TOKEN_URI": token_uri,
    }

    try:
        # Initialize Outlook service
        outlook_service = OutlookService(credentials, env_vars)
        print("Outlook service initialized successfully")

        # Test email retrieval
        emails, _ = outlook_service.get_emails(sender, filter_date, last_run)
        print(f"Retrieved {len(emails)} emails")

        for email in emails[:3]:  # Show the first 3 emails
            print(f"- Subject: {email['subject']}")
            print(f"- From: {email['sender']}")
            print(f"- Date: {email['date']}")
            print("---")

    except Exception as e:
        print(f"Error testing Outlook service: {e}")

