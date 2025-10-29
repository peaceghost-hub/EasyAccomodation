SendGrid setup and environment variables

Overview
--------
This project uses SendGrid via its Web API v3 to send transactional emails (email verification, admin notifications).
Sending is best-effort and will not block primary user flows if SendGrid is not configured.

Environment variables
---------------------
Set the following environment variables on the server (or in your local `.env` for development):

- SENDGRID_API_KEY: Your SendGrid API key (required for sending emails)
- FROM_EMAIL: The sender email address shown in outgoing mail (e.g. noreply@yourdomain.com)
- ADMIN_EMAIL: Administrative contact used in email bodies (optional)
- FRONTEND_BASE_URL: Public URL of your frontend (e.g. https://app.example.com). Used to build verification links.

Notes
-----
- Make sure the `FROM_EMAIL` domain is verified in your SendGrid account (or use a verified sender identity). Without proper sender verification SendGrid may reject or route messages to spam.
- For local development you can omit SENDGRID_API_KEY; the email helpers gracefully no-op when not configured.

How it works in the app
-----------------------
- After a student registers, the server generates an email verification token and calls `send_email_verification()` which uses SendGrid to send a verification link.
- Student clicks verification link -> frontend should call `POST /api/auth/verify-email` with the token to mark the email as verified.
- Student then uploads proof of payment from the student dashboard (file upload to `/api/payment-proofs/upload`).
- Admin reviews pending proofs at `/api/admin/payment-proofs/pending` and accepts/rejects them (`PUT /api/admin/payment-proofs/<id>/review`). On acceptance the server marks the student's `admin_verified` flag and calls `send_student_verified_email()`.

Security
--------
- Store SENDGRID_API_KEY securely (not checked into source). Use your hosting provider's secret manager or set environment variables on the host.
- Ensure the `FROM_EMAIL` is a verified sender in SendGrid to avoid deliverability issues.

Troubleshooting
---------------
- If emails are not delivered, check SendGrid activity logs and verify sender/domain.
- Use a test API key and a small test account when verifying the integration.

Contact
-------
If you need help, contact the app administrator (see `ADMIN_EMAIL` in `.env`).
