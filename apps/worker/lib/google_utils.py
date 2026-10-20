# Standard library imports
import base64
from datetime import datetime, timedelta, timezone
from typing import Any, List, Dict

# Third-party imports
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Local application imports
import lib.general_utils as utils


# Gmail API required permissions
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailService:
    def __init__(self, credentials: dict, env: dict):
        """
        Initialize GmailService with OAuth2 credentials.

        Args:
            credentials (dict): Dictionary containing OAuth2 credentials:
                - access_token: OAuth2 access token
                - refresh_token: OAuth2 refresh token
                - token_uri: Token endpoint URI
                - client_id: OAuth2 client ID
                - client_secret: OAuth2 client secret
                - scopes: List of granted scopes
        """
        credentials = self.add_clients(credentials, env)
        self.service = self.get_service(credentials)

    def get_service(self, token: dict) ->  Any:
        """
        Get a Gmail API service instance.
        """
        creds = self.authenticate(token)
        return build("gmail", "v1", credentials=creds)

    def get_emails(
            self,
            sender: str,
            filter_date: str,
            last_run: datetime,
            filter_date_before: str | None = None,
    ) -> tuple[List[Dict[str, Any]], str]:
        messages_ids, last_run_update = self.list_messages(
            sender,
            filter_date,
            filter_date_before,
        )

        if not messages_ids:
            return [], ""

        return self.get_email_messages(messages_ids, last_run), last_run_update

    def list_messages(self, sender: str, filter_date: str, filter_date_before: str | None = None) -> tuple[list, str]:
        """
        List messages from Gmail API matching specific criteria.

        This function:
        1. Constructs a Gmail search query
        2. Retrieves messages matching the query
        3. Returns message IDs and current timestamp

        Args:
            sender (str): Email address to filter messages from
            filter_date (str): Date to filter messages after (YYYY-MM-DD)
            filter_date_before (str, optional): Date to filter messages before (YYYY-MM-DD)

        Returns:
            tuple[list, str]: A tuple containing:
                - List of message IDs matching the criteria
                - Current timestamp in UTC-5 timezone
        """
        # Build Gmail search query
        query_parts = []

        query_parts.append(
            f"from:('{sender} OR alertasynotificaciones@bancolombia.com.co')"
        )

        query_parts.append(f"after:{filter_date}")

        if filter_date_before:
            query_parts.append(f"before:{filter_date_before}")

        query_string = " ".join(query_parts)
        print(f"Constructed Query: {query_string}\n")

        # Execute Gmail API request
        results = self.service.users().messages().list(userId="me", q=query_string).execute()

        # Get the current timestamp in UTC-5
        utc_minus_5 = timezone(timedelta(hours=-5))
        last_run_update = datetime.now(utc_minus_5).strftime("%Y-%m-%d %H:%M:%S.%f")

        messages = results.get("messages", [])
        print(f"Found {len(messages)} messages matching criteria")

        return messages, last_run_update

    def get_email_messages(self, messages_ids: list, last_run: datetime) -> List[Dict[str, Any]]:
        # Process each message to extract transaction data
        emails_data: List[Dict[str, Any]] = []
        message_id = None

        for message in messages_ids:
            try:
                message_id = message["id"]
                message_data = self.get_message_details(message_id)
                if utils.check_new_emails(message_data, last_run):
                    emails_data.append(message_data)
            except HttpError as e:
                print(f"Error processing message {message_id}: {str(e)}")
                continue

        return emails_data

    def get_message_details(self, message_id) -> dict:
        """
        Get detailed information about a specific Gmail message.

        This function:
        1. Retrieves the full message content
        2. Extracts HTML content and converts to plain text
        3. Cleans and formats the message body
        4. Extracts common headers (subject, sender, date)

        Args:
            message_id (str): ID of the message to retrieve

        Returns:
            dict: Message details containing:
                - id: Message ID
                - subject: Email subject
                - sender: Sender's email address
                - date: Message date
                - body: Cleaned message body text

        Raises:
            HttpError: If there's an error accessing the Gmail API
        """
        try:
            # Get full message content
            message = (
                self.service
                .users()
                .messages()
                .get(userId="me", id=message_id, format="full")
                .execute()
            )
            headers = message["payload"]["headers"]

            # Extract message headers
            subject = next(
                (h["value"] for h in headers if h["name"] == "Subject"), "No Subject"
            )
            sender = next(
                (h["value"] for h in headers if h["name"] == "From"), "Unknown Sender"
            )
            date = next(
                (h["value"] for h in headers if h["name"] == "Date"), "Unknown Date"
            )

            body = None
            charset = "UTF-8"  # Default charset
            date = utils.normalize_date_to_utc(date)

            def extract_charset(content_type: str) -> str:
                """Extract charset from Content-Type header, default to UTF-8."""
                parts = content_type.split(";")
                if len(parts) > 1:
                    for part in parts[1:]:
                        if "charset=" in part:
                            return part.strip().split("=")[1].strip('"')
                return "UTF-8"

            # Process message body
            if "multipart" in message["payload"]["mimeType"]:
                for part in message["payload"]["parts"]:
                    if part["mimeType"] in ["text/html"]:
                        # Extract and decode HTML content
                        body = part["body"]["data"]
                        if part.get("headers"):
                            content_type = next(
                                (h["value"] for h in part["headers"] if h["name"].lower() == "content-type"),
                                ""
                            )
                            charset = extract_charset(content_type)

                    elif part["mimeType"] in ["multipart/mixed", "multipart/related"]:
                        for prt in part["parts"]:
                            if prt["mimeType"] == "text/html":
                                body = prt["body"]["data"]
                                if prt.get("headers"):
                                    content_type = next(
                                        (h["value"] for h in prt["headers"] if h["name"].lower() == "content-type"),
                                        ""
                                    )
                                    charset = extract_charset(content_type)
            elif (
                    "text/html" in message["payload"]["mimeType"]
                    or "text/plain" in message["payload"]["mimeType"]
            ):
                body = message["payload"]["body"]["data"]
                charset = "UTF-8"

            else:
                body = "No data extracted from mail"

            # Decode data
            decoded_bytes = base64.urlsafe_b64decode(body)
            body_html = decoded_bytes.decode(charset, errors="replace")

            # Clean HTML and extract text
            soup = BeautifulSoup(body_html, "html.parser")
            for script in soup(["script", "style"]):
                script.decompose()
            text = soup.get_text()

            # Clean and format text
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            body_text = " ".join(chunk for chunk in chunks if chunk)

            return {
                "id": message_id,
                "subject": subject,
                "sender": sender,
                "date": date,
                "body": body_text,
            }
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise error

    @staticmethod
    def authenticate(token: dict) -> Credentials:
        """
        Authenticate with the Gmail API using provided credentials.

        This function:
        1. Creates credentials from the provided token
        2. Validates the credentials
        3. Refreshes expired credentials if possible
        4. Returns valid credentials for API access

        Returns:
            Credentials: Valid Gmail API credentials

        Raises:
            Exception: If credentials are invalid or cannot be refreshed
        """
        creds = Credentials.from_authorized_user_info(token, SCOPES)
        if not creds or not creds.valid:
            print("Invalid credentials")
            if creds and creds.expired and creds.refresh_token:
                print("Refreshing credentials")
                creds.refresh(Request())
            else:
                raise Exception("Invalid credentials")

        return creds

    @staticmethod
    def add_clients(credentials: dict, env_vars: dict):
        """
        Add clients to credentials
        """
        credentials["client_id"] = env_vars["GMAIL_CLIENT_ID"]
        credentials["client_secret"] = env_vars["GMAIL_CLIENT_SECRET"]
        credentials["token_uri"] = env_vars["GMAIL_TOKEN_URI"]

        return credentials


if __name__ == "__main__":
    from dotenv import load_dotenv
    from pathlib import Path
    import os

    # Load Env Vars
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / ".env"
    load_dotenv(dotenv_path=env_path)

    client_id = os.environ.get('GMAIL_CLIENT_ID')
    client_secret = os.environ.get('GMAIL_CLIENT_SECRET')
    token_uri = os.environ.get('GMAIL_TOKEN_URI')
    access_token = os.environ.get('GMAIL_ACCESS_TOKEN')
    refresh_token = os.environ.get('GMAIL_REFRESH_TOKEN')

    # Test parameters
    sender = "alertasynotificaciones@notificacionesbancolombia.com"
    last_run = datetime.now(timezone.utc) - timedelta(days=15) # Filter emails after this date
    filter_date = "2025-10-20"  # Filter emails after this date

    # Sample token for testing (replace with actual credentials)
    credentials = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "scopes": SCOPES
    }

    env_vars = {
        "GMAIL_CLIENT_ID": client_id,
        "GMAIL_CLIENT_SECRET": client_secret,
        "GMAIL_TOKEN_URI": token_uri,
    }

    try:
        # Initialize Gmail service
        gmail_service = GmailService(credentials, env_vars)
        print("Gmail service initialized successfully")

        # Test email retrieval
        emails, _ = gmail_service.get_emails(sender, filter_date, last_run)
        print(f"Retrieved {len(emails)} emails")

        for email in emails[:3]:  # Show the first 3 emails
            print(f"- Subject: {email['subject']}")
            print(f"- From: {email['sender']}")
            print(f"- Date: {email['date']}")
            print("---")

    except Exception as e:
        print(f"Error testing Gmail service: {e}")
