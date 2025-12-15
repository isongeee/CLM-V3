# Edge Functions (MVP)

Functions (see `supabase/functions/*/index.ts`):
- `ensure-user-profile`: creates/updates `public.users` for the authenticated user (required because RLS disallows client inserts).
- `invite-user`: join by `companies.invite_code` or admin-add by email.
- `create-audit-log`: server-side writes to `audit_logs`.
- `analyze-contract`: calls Gemini and stores results in `company_settings`.
- `sign-envelope`: internal signing; writes `signature_events`.
- `create-envelope`: creates an internal signature envelope + recipients and writes initial `signature_events`.
- `send-email`: SendGrid wrapper (stubbed if missing API key).
- `create-checkout-session`: Stripe checkout session creator.
- `stripe-webhook`: Stripe webhook handler (updates `company_settings`).

## Required env vars
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Gemini: `GEMINI_API_KEY`
- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
