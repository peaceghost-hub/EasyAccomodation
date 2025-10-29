import os
import requests
from config import Config


def send_admin_created_email(to_email: str, to_name: str, created_by_name: str):
    """
    Send a simple notification email to a newly created admin using SendGrid Web API v3.
    If SENDGRID_API_KEY is not configured, this becomes a no-op.
    """
    api_key = Config.SENDGRID_API_KEY
    if not api_key:
        # Email not configured, silently return
        print("SendGrid API key not configured - email not sent")
        return False

    from_email = getattr(Config, 'FROM_EMAIL', 'noreply@easyaccommodation.com')
    subject = 'Your admin account has been created'
    content = f"Hello {to_name},\n\nAn admin account for you was created by {created_by_name} on EasyAccommodation. You can now log in using your email. If you did not expect this, please contact support at {getattr(Config, 'ADMIN_EMAIL', 'admin@easyaccommodation.com')}.\n\nRegards,\nEasyAccommodation Team"

    url = 'https://api.sendgrid.com/v3/mail/send'
    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject
            }
        ],
        "from": {"email": from_email, "name": "EasyAccommodation"},
        "content": [
            {"type": "text/plain", "value": content}
        ]
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        print(f"Sending admin creation email to {to_email} from {from_email}...")
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        print(f"✅ Email sent successfully to {to_email}")
        return True
    except Exception as e:
        # Log the error but don't break admin creation flow
        print(f"❌ Failed to send email: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return False


def send_email_verification(to_email: str, to_name: str, token: str, frontend_base: str = None):
    """
    Send verification email to a newly-registered student with a link containing the token.
    If SENDGRID_API_KEY is not configured, this becomes a no-op.
    frontend_base (optional) can be provided to build a friendly link (e.g. https://app.example.com/verify-email)
    """
    api_key = Config.SENDGRID_API_KEY
    if not api_key:
        print("SendGrid API key not configured - email verification not sent")
        return False

    from_email = getattr(Config, 'FROM_EMAIL', 'noreply@easyaccommodation.com')
    subject = 'Verify your EasyAccommodation email'
    # If frontend_base provided, link to it; otherwise link to a default path that frontend will handle
    if frontend_base:
        verify_link = f"{frontend_base.rstrip('/')}/verify-email?token={token}"
    else:
        verify_link = f"/verify-email?token={token}"

    content = f"Hello {to_name},\n\nThanks for registering with EasyAccommodation. Please verify your email address by clicking the link below:\n\n{verify_link}\n\nAfter verifying you will be able to log in and upload proof of payment for subscription verification.\n\nRegards,\nEasyAccommodation Team"

    url = 'https://api.sendgrid.com/v3/mail/send'
    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject
            }
        ],
        "from": {"email": from_email, "name": "EasyAccommodation"},
        "content": [
            {"type": "text/plain", "value": content}
        ]
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        print(f"Sending verification email to {to_email} from {from_email}...")
        print(f"Verification link: {verify_link}")
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        print(f"✅ Verification email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send verification email: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return False


def send_student_verified_email(to_email: str, to_name: str):
    """
    Notify a student that the admin has verified their payment and account.
    """
    api_key = Config.SENDGRID_API_KEY
    if not api_key:
        print("SendGrid API key not configured - verification email not sent")
        return False

    from_email = getattr(Config, 'FROM_EMAIL', 'noreply@easyaccommodation.com')
    subject = 'Your EasyAccommodation account is fully verified'
    content = f"Hello {to_name},\n\nYour payment proof has been reviewed and your account was verified by the admin. You can now access all features of the app.\n\nRegards,\nEasyAccommodation Team"

    url = 'https://api.sendgrid.com/v3/mail/send'
    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject
            }
        ],
        "from": {"email": from_email, "name": "EasyAccommodation"},
        "content": [
            {"type": "text/plain", "value": content}
        ]
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        print(f"Sending student verified email to {to_email} from {from_email}...")
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        print(f"✅ Verified email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send verified email: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return False


def send_payment_proof_rejected_email(to_email: str, to_name: str, reason: str = None):
    """
    Notify a student that their payment proof was rejected (invalid).
    """
    api_key = Config.SENDGRID_API_KEY
    if not api_key:
        print("SendGrid API key not configured - rejection email not sent")
        return False

    from_email = getattr(Config, 'FROM_EMAIL', 'noreply@easyaccommodation.com')
    subject = 'Payment Proof Rejected - Invalid Proof of Payment'
    
    reason_text = f"\n\nReason: {reason}" if reason else ""
    content = f"Hello {to_name},\n\nYour payment proof has been reviewed and unfortunately it was rejected as invalid.{reason_text}\n\nPlease upload a valid proof of payment to proceed with your account verification.\n\nRegards,\nEasyAccommodation Team"

    url = 'https://api.sendgrid.com/v3/mail/send'
    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject
            }
        ],
        "from": {"email": from_email, "name": "EasyAccommodation"},
        "content": [
            {"type": "text/plain", "value": content}
        ]
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        print(f"Sending rejection email to {to_email} from {from_email}...")
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        print(f"✅ Rejection email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send rejection email: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return False
