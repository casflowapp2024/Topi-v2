# Standard library imports
import json
from typing import Dict, Any, List, Optional

# Third-party imports
import requests
from requests.exceptions import RequestException

# Standard headers for API requests
API_HEADERS = {
    "Content-type": "application/json",
    "Accept": "text/plain",
}

# Error code mapping for error identification
ERROR_CODE_MAPPING = {
    "AUTH_FAILED": "Authentication failed",
    "INVALID_CREDENTIALS": "Invalid credentials provided",
    "EMAIL_PARSE_ERROR": "Failed to parse email content",
    "EMAIL_CONNECTION_ERROR": "Failed to connect to email service",
    "EMAIL_READ_ERROR": "Failed to read email messages",
    "EMAIL_CONFIG_ERROR": "Email configuration error",
    "DATABASE_ERROR": "Database operation failed",
    "API_TIMEOUT": "API request timeout",
    "INVALID_DATA_FORMAT": "Invalid data format received",
    "PERMISSION_DENIED": "Permission denied for operation",
    "RATE_LIMIT_EXCEEDED": "Rate limit exceeded",
    "SERVICE_UNAVAILABLE": "Service temporarily unavailable",
    "UNKNOWN_ERROR": "Unknown error occurred"
}


class CashflowBack:
    """
    Client class for interacting with the Cashflow backend API.
    
    This class encapsulates all API operations related to authentication,
    automation management, transaction handling, email configuration, and error reporting.
    """
    
    def __init__(self, db_endpoint: str, admin_mail: str, admin_password: str):
        """
        Initialize the CashflowBack client.
        
        Args:
            db_endpoint (str): Base URL of the database API
            admin_mail (str): User's email address
            admin_password (str): User's password
        """
        self.db_endpoint = db_endpoint
        self.admin_mail = admin_mail
        self.admin_password = admin_password
        self.token = None
    
    def authenticate(self) -> None:
        """
        Authenticate a user and retrieve an access token.

        Raises:
            RequestException: If the authentication request fails,
            ValueError: If the response doesn't contain a valid token
        """
        try:
            auth_data = {
                "email": self.admin_mail,
                "password": self.admin_password,
            }

            response = requests.post(
                self.auth_endpoint,
                data=json.dumps(auth_data),
                headers=API_HEADERS,
            )

            response.raise_for_status()

            # Extract token from response
            token = response.json().get("data", {}).get("access_token")
            if not token:
                raise ValueError("No access token found in response")

            # Store token for future requests
            self.token = token

        except RequestException as e:
            raise

    def list_automations(self, time: str) -> Dict[str, Any]:
        """
        Retrieve a list of automations for a specific time period.

        Args:
            time (str): Time period for filtering the automations

        Returns:
            Dict[str, Any]: JSON response containing automation data

        Raises:
            RequestException: If the request fails
            ValueError: If authentication fails
        """
        try:
            list_params = {
                "skip": 0,
                "limit": 100,
                "automation_time": time,
            }

            response = requests.get(
                self.list_accounts_endpoint,
                params=list_params,
                headers=self.get_headers(),
            )

            response.raise_for_status()

            return response.json()

        except (RequestException, ValueError) as e:
            raise

    def send_txn_to_db(self, user_id: str, transactions: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Send transaction data to the database.

        Args:
            user_id (str): ID of the user whose transactions are being sent
            transactions (List[Dict[str, Any]]): List of transaction data to send

        Returns:
            Dict[str, str]: Status message indicating success or failure

        Raises:
            RequestException: If the request fails
            ValueError: If authentication fails or transactions are invalid
        """
        try:
            # Validate input
            if not transactions:
                raise ValueError("No transactions provided")

            txn_data = {
                "user_id": user_id,
                "transactions": transactions,
            }

            response = requests.post(
                self.txn_endpoint,
                data=json.dumps(txn_data),
                headers=self.get_headers(),
            )

            response.raise_for_status()

            return {"status": "success", "message": "Transactions sent successfully"}

        except Exception as e:
            print(f"Failed to send transaction data: {str(e)}")
            raise

    def get_email_tokens(self, user_id: str, email_config_id: str) -> Dict[str, Any] | None:
        """
        Get email tokens for a user.

        Args:
            user_id (str): ID of the user whose email tokens are being retrieved
            email_config_id (str): ID of the email configuration

        Returns:
            Dict[str, Any]: Email token data
        """
        try:
            response = requests.get(
                self.email_token_endpoint(user_id, email_config_id),
                headers=self.get_headers(),
            )

            response.raise_for_status()

            if response.status_code == 200:
                return response.json()["data"]

        except (RequestException, ValueError) as e:
            raise

    def send_user_error(self, email_id: Optional[str], error_message: str) -> Dict[str, Any]:
        """
        Send user error to the database with automatic error code mapping.

        Args:
            email_id (Optional[str]): ID of the email configuration
            error_message (str): Error message that will be mapped to an error code

        Returns:
            Dict[str, Any]: Status message indicating success or failure
        """
        try:
            if self.db_endpoint is None or email_id is None or self.token is None:
                return {
                    "status": "error",
                    "message": "Missing required parameters to set error",
                    "params": f"db_endpoint: {self.db_endpoint}, email_id: {email_id}, token: {self.token}"
                }

            USER_ERRORS = ("OAUTH_CLIENT_DELETED", "TOKEN_EXPIRED_OR_REVOKED")

            # Map error message to error code
            error_code = self._map_error_message_to_code(error_message)

            if error_code in USER_ERRORS:
                error_data = {
                    "error": error_code
                }

                response = requests.put(
                    self.error_endpoint(email_id),
                    data=json.dumps(error_data),
                    headers=self.get_headers(),
                )

                response.raise_for_status()

                if response.status_code == 200:
                    return {
                        "status": "success",
                        "message": "Error sent successfully to backend",
                    }
                else:
                    return {
                        "status": str(response.status_code),
                        "message": "Failed to send error to backend "
                    }
            else:
                return {
                    "status": "error",
                    "message": "Error is not in USER_ERRORS",
                }
        except Exception as e:
            return {"status": str(response.status_code), "message": "Failed to send error to backend: " + str(e)}

    def confirm_email_read(self, user_id: str):
        try:
            params = {
                "user_id": user_id,
                "read": True,
            }

            response = requests.put(
                self.read_email_endpoint,
                data=json.dumps(params),
                headers=self.get_headers(),
            )

            if response.status_code == 200:
                print("Confirmed email read successfully")
            else:
                print(f"Failed to confirm email read, status: {response.status_code}")

        except (RequestException, ValueError) as e:
            raise e

    @staticmethod
    def _map_error_message_to_code(error_message: str) -> str | None:
        """
        Map an error message to its corresponding error code.

        Args:
            error_message (str): The error message to map

        Returns:
            str: The corresponding error code
        """
        error_message_lower = error_message.lower()

        # Authentication-related errors
        if "Client Error: Bad Request for url" in error_message:
            return "BAD_REQUEST"
        elif "The OAuth client was deleted." in error_message:
            return "OAUTH_CLIENT_DELETED"

        elif "Client Error: Bad Request for url" in error_message:
            return "400: BAD_REQUEST"
        elif "Token has been expired or revoked" in error_message:
            return "TOKEN_EXPIRED_OR_REVOKED"

        # Email related errors
        elif any(keyword in error_message_lower for keyword in ['email', 'mail']):
            if any(keyword in error_message_lower for keyword in ['parse', 'parsing', 'format']):
                return "EMAIL_PARSE_ERROR"
            elif any(keyword in error_message_lower for keyword in ['connect', 'connection', 'timeout']):
                return "EMAIL_CONNECTION_ERROR"
            elif any(keyword in error_message_lower for keyword in ['read', 'fetch', 'retrieve']):
                return "EMAIL_READ_ERROR"
            elif any(keyword in error_message_lower for keyword in ['config', 'configuration', 'setup']):
                return "EMAIL_CONFIG_ERROR"

        # Database-related errors
        elif any(keyword in error_message_lower for keyword in ['database', 'db', 'sql', 'query']):
            return "DATABASE_ERROR"

        # API-related errors
        elif any(keyword in error_message_lower for keyword in ['timeout', 'timed out']):
            return "API_TIMEOUT"
        elif any(keyword in error_message_lower for keyword in ['rate limit', 'too many requests']):
            return "RATE_LIMIT_EXCEEDED"
        elif any(keyword in error_message_lower for keyword in ['service unavailable', '503', 'unavailable']):
            return "SERVICE_UNAVAILABLE"

        # Permission-related errors
        elif any(
                keyword in error_message_lower for keyword in ['permission', 'access denied', 'forbidden', 'unauthorized']):
            return "PERMISSION_DENIED"

        # Data format errors
        elif any(keyword in error_message_lower for keyword in ['format', 'invalid data', 'malformed', 'json']):
            return "INVALID_DATA_FORMAT"

        # Default fallback
        else:
            return "UNKNOWN_ERROR"

    @property
    def auth_endpoint(self):
        return f"{self.db_endpoint}/prod/users/login"

    @property
    def list_accounts_endpoint(self):
        return f"{self.db_endpoint}/prod/accounts/admin/list"

    @property
    def txn_endpoint(self):
        return f"{self.db_endpoint}/prod/transactions/admin/create"

    @property
    def read_email_endpoint(self):
        return f"{self.db_endpoint}/prod/user-extra/admin/read-email"

    def error_endpoint(self, email_id: str):
        return f"{self.db_endpoint}/prod/email/admin/error/{email_id}"

    def email_token_endpoint(self, user_id: str, email_config_id: str):
        return f"{self.db_endpoint}/prod/email/{user_id}/{email_config_id}"

    def get_headers(self):
        if not self.token:
            raise ValueError("No authentication token available")

        return {
            **API_HEADERS,
            "authorization": f"Bearer {self.token}",
        }
