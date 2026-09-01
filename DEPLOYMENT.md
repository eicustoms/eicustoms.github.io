DEPLOYMENT AND SMS SETUP

This file documents the environment variables and steps for deploying the Node backend on Railway (or any other host) and enabling SMS notifications via Twilio.

Required environment variables (Railway - set these in your project settings):

- DATABASE_URL
  - Your PostgreSQL connection string (Railway provides this).
  - Example: postgres://user:pass@host:5432/dbname

- ADMIN_PASSWORD
  - Password for the simple admin login on /admin (keep strong and secret).

- SESSION_SECRET
  - A random secret used to sign admin session tokens.

- EMAIL_USER, EMAIL_PASSWORD
  - Optional: used to send email notifications (Gmail currently configured). If not set, email notifications are skipped.

Twilio (SMS) configuration (optional but required to enable SMS notifications):

- TWILIO_ACCOUNT_SID  (required if you want SMS)
- TWILIO_AUTH_TOKEN   (required if you want SMS)
- TWILIO_FROM_NUMBER  (the Twilio phone number that sends SMS)
- CONTACT_SMS_TO      (optional; defaults to +1 848-333-5057 if unset)

Notes:
- The code will send an SMS on contact form submission only when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are set as environment variables in Railway.
- No Twilio credentials are committed in the repo; please add them via Railway's environment UI.

Railway deployment (high level):
1. Create a Railway project and connect your repository.
2. Add a PostgreSQL plugin (Railway) or provide an existing DATABASE_URL.
3. Set the environment variables listed above in the Railway project settings.
4. Ensure the start command is `node server.js` (package.json "start" script is configured).
5. Deploy and check logs for successful `Database initialized` and server start.

Database migration (optional):
- The app includes both a PostgreSQL-backed path (when DATABASE_URL exists) and a fallback that reads/writes JSON files (submissions.json, homepage-comments.json) for local development.
- If you want to migrate existing JSON entries into the Postgres DB, create a one-time migration script that reads the JSON files and inserts rows into the DB, then remove JSON fallback if desired.

Testing SMS:
- Use a Twilio trial account (if applicable) and verify the CONTACT_SMS_TO number with Twilio if you are on a trial.
- After setting TWILIO env vars and restarting, submit the contact form and check Railway logs for "SMS notification sent" or Twilio console for message delivery status.

If you want me to add a small migration helper script or a verification endpoint for Twilio configuration, say the word and I'll include it in the PR.
