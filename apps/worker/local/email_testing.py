from lambda_code.extract_emails_new.prompt_v3 import prompt
from lambda_code.lib import google_utils, microsoft_utils
from lambda_code.lib.gemini import Gemini


def gmail_credentials():
    client_id = os.environ.get('GMAIL_CLIENT_ID')
    client_secret = os.environ.get('GMAIL_CLIENT_SECRET')
    token_uri = os.environ.get('GMAIL_TOKEN_URI')
    access_token = os.environ.get('GMAIL_ACCESS_TOKEN')
    refresh_token = os.environ.get('GMAIL_REFRESH_TOKEN')

    # Sample token for testing (replace with actual credentials)
    credentials = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "scopes": google_utils.SCOPES
    }

    env_vars = {
        "GMAIL_CLIENT_ID": client_id,
        "GMAIL_CLIENT_SECRET": client_secret,
        "GMAIL_TOKEN_URI": token_uri,
    }

    return credentials, env_vars


def outlook_credentials():
    client_id = os.environ.get('OUTLOOK_CLIENT_ID')
    client_secret = os.environ.get('OUTLOOK_CLIENT_SECRET')
    token_uri = os.environ.get('OUTLOOK_TOKEN_URI')
    refresh_token = os.environ.get('OUTLOOK_REFRESH_TOKEN')

    # Sample token for testing (replace with actual credentials)
    credentials = {
        "refresh_token": refresh_token,
    }

    env_vars = {
        "OUTLOOK_CLIENT_ID": client_id,
        "OUTLOOK_CLIENT_SECRET": client_secret,
        "OUTLOOK_TOKEN_URI": token_uri,
    }

    return credentials, env_vars


if __name__ == "__main__":
    from datetime import datetime, timedelta, timezone
    from dotenv import load_dotenv
    from pathlib import Path
    import os
    import time

    # Load Env Vars
    project_root = Path(__file__).parent.parent
    env_path = project_root / ".env"
    load_dotenv(dotenv_path=env_path)

    # Test parameters
    user_provider = "gmail"
    # sender = "noreply@rappipay.co" # noreply@rappipay.co, noreply@rappicard.co

    sender = "BBVA@bbvanet.com.co" #,notificacionesBreB@bbva.com
    filter_date = "2026-01-04"  # Filter emails after this date
    last_run = datetime.now(timezone.utc) - timedelta(days=7)  # Filter emails after this date

    email_service = None
    if user_provider == "gmail":
        # Initialize Gmail API service
        credentials, env_vars = gmail_credentials()
        email_service = google_utils.GmailService(credentials, env_vars)

    elif user_provider == "outlook":
        credentials, env_vars = outlook_credentials()
        email_service = microsoft_utils.OutlookService(credentials, env_vars)

    emails, _ = email_service.get_emails(
        sender,
        filter_date,
        last_run,
    )

    indexes = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]
    filtered_emails = [emails[i] for i in indexes]

    # Parse Email Data Using AI
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    ai = Gemini(gemini_api_key, prompt)


    # Measure execution time
    start_time = time.time()

    transactions = ai.process_messages(filtered_emails)

    end_time = time.time()
    execution_time = end_time - start_time
    print(f"⏱️  process_messages execution time: {execution_time:.2f} seconds ({execution_time:.4f}s)")
    print(f"📧 Total emails retrieved: {len(emails)}")

    if not transactions:
        print("No transactions emails found after Gemini API request")
