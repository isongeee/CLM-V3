# V3 CLM (Enterprise, multi-tenant)

## Prereqs
- Node.js 20+
- A Supabase project (or `supabase start` locally)

## Supabase
- Run SQL scripts in order (schema first, then RLS):
  - `supabase/schema_UPDATED_ENTERPRISE_v2.sql`
  - `supabase/rls_UPDATED_ENTERPRISE_v2.sql`

## Env vars
Create `.env.local`:
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

For Edge Functions and scripts, see `.env.example` (service role, Gemini, SendGrid, Stripe).

## Run
```bash
npm install
npm run dev
```

## Dev seed (optional)
```bash
# Uses service role (bypasses RLS); if you provide SEED_CREATOR_USER_ID it will auto-create an admin membership via DB trigger.
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_CREATOR_USER_ID=... node scripts/seed-dev.mjs
```
