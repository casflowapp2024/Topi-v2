import os

from lambda_code.lib.api_utils import CashflowBack


def main():
    base_endpoint = os.environ.get("API_URL", "http://localhost:8080")
    user_mail = os.environ.get("ADMIN_EMAIL", "")
    password = os.environ.get("ADMIN_PASSWORD", "")
    user_id = os.environ.get("TEST_USER_ID", "")
    email_id = str(55)

    # Initialize CashflowBack client
    cashflow_client = CashflowBack(
        db_endpoint=base_endpoint,
        admin_mail=user_mail,
        admin_password=password,
    )

    cashflow_client.authenticate()

    cashflow_client.confirm_email_read(user_id)

if __name__ == "__main__":
    main()
