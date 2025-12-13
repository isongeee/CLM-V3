# Enterprise Contract Lifecycle Management (CLM) Database + Security Reference

This repository defines a **multi-tenant, enterprise-grade CLM** database on Supabase/Postgres with:
- tenant isolation (RLS)
- private contract document storage (Supabase Storage + path-based policies)
- configurable approval workflows + audit logs
- AI layer (requests + embeddings for RAG)
- enterprise integration primitives (webhooks + delivery outbox)
- enterprise IT primitives (SSO connections + external identities)

## Landing page
Open `index.html` to view a simple landing page that summarizes this repo and links to the reference docs/scripts.

## What to run (fresh install)

Run these in order:

1) **Base schema**  
   - `schema_UPDATED_ENTERPRISE.sql`

2) **Enterprise feature layer (schema patch v2)**  
   - `schema_ENTERPRISE_CLM_REFERENCE_V2.sql`

3) **Base RLS + storage hardening**  
   - `rls_UPDATED_ENTERPRISE.sql`

4) **Enterprise RLS patch v2**  
   - `rls_ENTERPRISE_CLM_REFERENCE_V2.sql`

> Tip: If you already ran the base scripts, you can run the v2 patch scripts safely (they use `IF NOT EXISTS` / additive migrations where possible).

## Login + sign up UI (demo)
This repo includes a minimal static auth UI wired for Supabase Auth:
- Login: `auth/login.html`
- Sign up (two options): `auth/signup.html` (create organization OR join organization via invite code)

### Required DB migration
Run after the base schema is installed:
- `migrations/0001_auth_onboarding.sql`

### Run locally
1) Serve the repo root over HTTP (auth callback needs a real origin):
   - `python -m http.server 8080`
2) Open:
   - `http://localhost:8080/auth/signup.html`
3) Supabase config (Project URL + anon key) is set in `auth/config.js` (override via the **Supabase config** section in `auth/callback.html` if needed).
4) Complete sign up, then continue in:
   - `http://localhost:8080/app/index.html`

### Tests
- `node --test`

## Key enterprise decisions

### Private document storage (no public URLs)
- Storage bucket `contracts` is **private**.
- Database stores a **storage path** (e.g. `<company_id>/contracts/<contract_id>/<document_id>.pdf`) in `contract_documents.storage_path`.
- Frontend should fetch files via **signed URLs** or a **server-side proxy** (Edge Function) that enforces tenant access.

### Tenant integrity is enforced structurally
- `contract_versions` and `contract_embeddings` enforce `(contract_id, company_id)` referential integrity.
- `contract_documents.company_id` is required (and must match the parent contract’s company in RLS).

### Webhooks are reliable (outbox pattern)
- `webhooks` stores subscriptions.
- `webhook_deliveries` is the outbox + delivery log (retries, error tracking).
- End-users can **read** deliveries but cannot mutate delivery records (writes are reserved for trusted server-side code).

### Normalized external identity mapping
- `external_identities` provides a strict, unique mapping across providers (Salesforce/ERP/etc.)
- `contracts.external_ids` and `counterparties.external_ids` exist for quick compatibility, but `external_identities` is the recommended canonical source for uniqueness.

## Where to look next
- See **DATABASE_REFERENCE_ENTERPRISE_CLM.md** for the table-by-table reference and conventions.
