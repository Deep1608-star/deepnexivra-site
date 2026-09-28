# Operating Room delivery setup

The Operating Room intake is implemented at `/api/operating-room` and intentionally refuses to claim success until private delivery is configured.

## Required Vercel environment variables

- `RESEND_API_KEY` — add directly in Vercel; do not commit it.
- `OPERATING_ROOM_TO_EMAIL` — inbox that should receive private cases. Multiple comma-separated addresses are supported.
- `OPERATING_ROOM_FROM_EMAIL` — verified Resend sender, for example `Deep Nexivra <cases@yourdomain.com>`.

## Optional

- `OPERATING_ROOM_BOOKING_URL` — a Calendly, Cal.com, or other private booking URL. If present, it is shown only after a case is successfully delivered.

## Behavior

- Human-review positioning only; no diagnosis or recommendations are generated.
- Selected Operating Room signal is carried privately into the submission as context.
- The visitor can optionally request a private conversation with Deep.
- Server-side validation and a honeypot field are enabled.
- If delivery variables are missing, the API returns `delivery_not_configured` and the UI clearly states that nothing was sent.

## Deployment note

After adding or changing Vercel environment variables, create a fresh deployment so the serverless function receives the updated values.
