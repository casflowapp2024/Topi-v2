import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

from google import genai
from google.genai import types
from google.genai.types import GenerateContentResponse

import lib.general_utils as utils


class Gemini:
    """
    A wrapper class for interacting with Google's Gemini API to process email content
    and extract transaction information for financial tracking applications.

    This class provides methods to process email messages through the Gemini API,
    parse responses, and extract structured transaction data from unstructured email content.

    Attributes:
        api_key (str): The Google Gemini API key for authentication
        prompt (str): System instruction prompt that guides the API's response format
        model (str): The Gemini model version to use for content generation
        client: Initialized Gemini API client instance
    """

    def __init__(self, api_key: str, prompt: str, model: str = "gemini-2.5-flash-lite"):
        """
        Initialize the Gemini request processor.

        Other models available:
            - gemini-2.5-flash-lite
            - gemini-2.5-flash
            

        Args:
            api_key (str): Google Gemini API key for authentication
            prompt (str): System instruction prompt for the API that defines the expected response format
            model (str, optional): The Gemini model to use. Defaults to "gemini-2.0-flash"
        """
        self.api_key = api_key
        self.prompt = prompt
        self.model = model
        self.client = genai.Client(api_key=api_key)

    def process_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Process email contents through Google's Gemini API to extract transaction information.

        This function:
        1. Processes each email concurrently through the API (up to 5 workers)
        2. Parses the response to extract transaction details
        3. Validates and formats the extracted data

        Args:
            messages (List[Dict[str, str]]): List of dictionaries containing email data:
                - processed_content (str): The email body content
                - date (str): Email date in format "YYYY-MM-DD HH:MM:SS %z"

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
        
        # Process messages concurrently with ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=10) as executor:
            # Submit all tasks
            futures = [executor.submit(self.process_single_message, message) for message in messages]
            
            # Collect results as they complete (fail-fast behavior maintained)
            for future in as_completed(futures):
                transaction = future.result()  # This will raise if the task raised
                
                print(f"Transaction: {transaction}")
                
                # Only append transactions where "amount" exists and is not 0
                amount = transaction.get("amount")
                if amount is not None and amount != 0:
                    transactions.append(transaction)
        
        return transactions

    def process_single_message(self, message: Dict[str, str]) -> Dict[str, Any]:
        """
        Process a single email content through Google's Gemini API to extract transaction information.

        This method handles the complete workflow for processing a single email:
        1. Extracts email body content
        2. Generates a response from the Gemini API
        3. Parses the API response
        4. Processes and validates the extracted data

        Args:
            message (Dict[str, str]): Dictionary containing email data with keys:
                - body (str): The email body content to process
                - date (str): Email date in format "YYYY-MM-DD HH:MM:SS %z"

        Returns:
            Dict[str, Any]: Processed transaction data containing:
                - account_number (str, optional): Last 4 digits of account
                - description (str, optional): Transaction description
                - expense (bool, optional): Whether it's an expense
                - amount (float): Transaction amount (0 if no transaction detected)
                - date (str): Transaction date

        Raises:
            Exception: If there's an error in the Gemini API request or response parsing
        """
        email_data = message["body"]
        try:
            # Send request to Gemini API
            response = self.generate_response(email_data)

            # Parse JSON response
            transaction_data = self.parse_response(message, response)

            return self.process_data(transaction_data)

        except Exception as e:
            print(f"Error processing Gemini request: {e}")
            raise

    def generate_response(self, email_data: str) -> GenerateContentResponse:
        """
        Generate a response from Google's Gemini API for the given email content.

        This method sends the email content to the Gemini API along with the system
        instruction prompt to extract structured transaction information.

        Args:
            email_data (str): The email content to be processed by the API

        Returns:
            GenerateContentResponse: The raw response object from the Gemini API

        Raises:
            Exception: If the API request fails or returns an error
        """
        response = self.client.models.generate_content(
            model=self.model,
            config=types.GenerateContentConfig(system_instruction=self.prompt),
            contents=email_data,
        )

        return response

    @staticmethod
    def parse_response(item: dict[str, str], response: GenerateContentResponse) -> Any:
        """
        Parse the Gemini API response and extract transaction data.

        This static method processes the raw API response by:
        1. Cleaning the response text (removing markdown code block markers)
        2. Parsing the JSON content
        3. Adding the original email date to the transaction data

        Args:
            item (dict[str, str]): The original email item containing date information
            response (GenerateContentResponse): The raw response from the Gemini API

        Returns:
            Any: Parsed transaction data as a dictionary with date information added

        Raises:
            json.JSONDecodeError: If the response text is not valid JSON
        """
        response_text = response.text.replace("```json\n", "").replace("\n```", "")
        transaction_data = json.loads(response_text)
        transaction_data["date"] = item["date"]
        return transaction_data

    @staticmethod
    def process_data(transaction_data):
        """
        Process and validate transaction data extracted from the API response.

        This static method performs final processing on the transaction data:
        1. Checks if transaction detection was performed
        2. Parses and validates the amount field if present
        3. Ensures proper data formatting for downstream processing

        Args:
            transaction_data (dict): Raw transaction data from the API response

        Returns:
            dict: Processed transaction data with validated and formatted fields

        Note:
            Uses general_utils.parse_amount() to standardize amount formatting
        """
        if "transaction_detected" not in transaction_data:
            if "amount" in transaction_data:
                transaction_data["amount"] = utils.parse_amount(
                    str(transaction_data["amount"])
                )

        return transaction_data


