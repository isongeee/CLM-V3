# Enterprise Contract Lifecycle Management (CLM) - Master Plan & Reference (V3)

Updated: 2025-12-15
Repo: `V3-CLM`

This document is a single-source overview of the Enterprise CLM in this repository: product scope, features, architecture, database/security model, and an implementation roadmap. It is derived from the current code, SQL schema/RLS scripts, and the existing reference documents (`README_ENTERPRISE_CLM.md`, `CONTEXT_ENTERPRISE_CLM.md`, `DATABASE_REFERENCE_ENTERPRISE_CLM.md`).

---

## 1) Product overview

Enterprise CLM manages the full contract lifecycle for organizations (tenants): intake, drafting, negotiation, approvals, execution, storage, obligations, renewals, reporting, and integrations - while enforcing enterprise-grade isolation, auditability, and reliability.

What this repo contains today:
- A Supabase/Postgres schema with multi-tenancy + RLS, plus a private-storage pattern for contract documents.
- An onboarding flow (create organization / join via invite code) using RPCs.
- A minimal static frontend (landing + auth + a tiny app page) and a demo billing page.
- A Supabase Edge Function for subscription management (demo).

What this repo intentionally does not fully implement yet:
- Full contract UI (CRUD, versioning UI, clause/template tooling UI).
- Webhook dispatcher/retry worker (outbox processor).
- Audit log writer service (append-only inserts from trusted code).
- Embeddings pipeline (document chunking + vector writes) and AI execution layer.

---

## 2) Non-negotiables (enterprise baseline)

These are enforced by design and referenced throughout the SQL + policies:

1. Tenant isolation is mandatory
   - Every tenant-owned row has `company_id`.
   - RLS checks membership via `public.is_company_member(company_id)` and admin rights via `public.is_company_admin(company_id)`.

2. Contract documents are private
   - Storage bucket `contracts` is private; no public URLs.
   - The database stores object keys (paths) in `contract_documents.storage_path`.

3. Auditability
   - `audit_logs` is append-only and written by trusted server-side code.
   - Approvals and status transitions must be traceable to a user + timestamp.

4. Reliable integrations
   - Webhooks use an outbox/delivery log (`webhook_deliveries`) to support retries and investigations.

---

## 3) Feature set (as represented in the codebase)

### A) Tenancy, onboarding, and IAM

Implemented:
- Organizations (tenants): `companies`
- Membership: `company_users` (admin flag + activity fields)
- User profile sync: `public.users` is kept in sync with `auth.users`
- Onboarding RPCs (used by the demo UI):
  - `public.create_company_and_join(p_company_name text)`
  - `public.join_company_by_invite_code(p_invite_code text)`

Enterprise extension points (schema present; UI not complete):
- RBAC roles: `roles`
- SSO connections: `sso_connections` (SAML/OIDC configuration per tenant)
- External identity mapping: `external_identities` (canonical mapping for CRM/ERP IDs)

### B) Contract data model (core CLM)

Schema present:
- Contracts: `contracts`
- Versioning: `contract_versions` (tenant-consistent via composite integrity rules)
- Documents metadata: `contract_documents` (stores `storage_path`, not URLs)
- Counterparties: `counterparties`
- Classification: `contract_types`, `contract_categories`
- Clause library: `clause_library`
- Templates: `contract_templates`
- Custom fields: `custom_fields` (tenant-defined fields)
- Company settings: `company_settings`
- Collaboration: `comments`
- Obligations/follow-ups: `tasks`
- Notifications: `notifications`

Vertical-specific primitives (present):
- `properties` and `expense_types` support real-estate flavored workflows without hardcoding into core contract tables.

### C) Workflow, governance, and audit

Schema present:
- Approval definitions: `approval_workflows`, `approval_workflow_steps`
- Approval runtime: `approval_steps` (who approved, when, decision)
- Audit: `audit_logs` (append-only; end users cannot insert by design)

### D) AI layer (traceable + tenant-scoped)

Schema present:
- AI settings: `ai_configs`
- Requests & traceability: `analysis_requests` (stores inputs/outputs/errors per user + tenant)
- RAG storage: `contract_embeddings` (tenant + contract scoped; stores chunk content + vector)

Planned:
- A service/worker that:
  - ingests `contract_documents`,
  - extracts text,
  - chunks + hashes,
  - writes to `contract_embeddings`,
  - and updates status back into `analysis_requests` / contract metadata.

### E) Integrations (webhooks + reliability)

Schema present:
- `webhooks` (tenant subscriptions + secrets)
- `webhook_deliveries` (outbox + delivery status log)

Planned:
- A dispatcher that reads pending deliveries, performs retries with backoff, and records responses/errors.

### F) Billing (optional demo layer)

Implemented:
- Billing schema: `plans`, `company_subscriptions`, `billing_events`, `invoices`
- Demo billing UI: `app/subscription.html` + `app/subscription.js`
- Edge Function: `supabase/functions/subscription-manager/index.ts`
  - Admin-only membership check via `company_users.is_admin`
  - Actions: `create_subscription`, `change_plan`, `cancel_subscription`

---

## 4) Primary user journeys (target workflows)

### Journey 1: Organization onboarding
1. User signs up in `auth/signup.html`.
2. User chooses:
   - Create an organization -> calls `create_company_and_join`
   - Join an organization -> calls `join_company_by_invite_code`
3. User is redirected to `app/index.html`, which lists organizations and exposes Billing for a company.

### Journey 2: Contract lifecycle (target end-state)
1. Intake/create a contract record (`contracts`) and optionally select type/category/counterparty.
2. Draft via templates/clause library:
   - `contract_templates` + `clause_library`
   - create a `contract_versions` draft
3. Negotiate & collaborate
   - comments (`comments`)
   - tasks/obligations (`tasks`)
4. Route for approvals
   - assign `approval_workflow` and create runtime `approval_steps`
   - record decisions, timestamps, and approvers
5. Execute
   - store final artifacts in `contract_documents` (private storage key)
6. Operate
   - notifications (`notifications`)
   - renewal/obligation tasks (`tasks`)
7. Report & integrate
   - analytics via queries/views (planned)
   - webhooks to downstream systems (`webhooks` + `webhook_deliveries`)

### Journey 3: Document storage & access (private-by-default)
1. Upload to the private bucket `contracts` using an object key:
   - `<company_id>/contracts/<contract_id>/<document_id>.<ext>`
2. Persist that key in `contract_documents.storage_path`.
3. Deliver access via:
   - signed URLs, or
   - an authenticated server-side proxy (Edge Function) that enforces tenant membership.

---

## 5) Architecture (what runs where)

Frontend (static):
- Landing: `index.html`, `landing/*`
- Documentation viewer: `docs.html` + `docs.js` (renders the markdown docs)
- Auth UI (Supabase Auth): `auth/*`
- Minimal app UI: `app/*`
- Dev server: Vite (`npm run dev`)

Backend (Supabase):
- Database: Postgres schema + RLS policies in:
  - `schema_UPDATED_ENTERPRISE.sql`
  - `schema_ENTERPRISE_CLM_REFERENCE_V2.sql`
  - `schema_BILLING_ENTERPRISE.sql` (optional)
  - `rls_UPDATED_ENTERPRISE.sql`
  - `rls_ENTERPRISE_CLM_REFERENCE_V2.sql`
  - `rls_BILLING_ENTERPRISE.sql` (optional)
- Migration:
  - `migrations/0001_auth_onboarding.sql` (auth/user sync + onboarding RPCs)
- Edge Function:
  - `supabase/functions/subscription-manager/index.ts` (demo billing actions)

Trusted server-side workers (planned; required for full enterprise CLM):
- Audit log writer (service role)
- Webhook dispatcher/retry worker (service role)
- Embeddings pipeline + AI job runner (service role)

---

## 6) Data model: what tables exist and why

This repo's schema is organized into layers:

Tenant roots & IAM:
- `companies`: tenant root
- `company_users`: membership, including admin gating
- `roles`: tenant RBAC roles (optional extension)
- `users`: app-visible user profile (FK target), synced from `auth.users`

Contract domain:
- `contracts`: canonical contract record (status, dates, owner, renewal fields)
- `contract_versions`: version snapshots/drafts for negotiation
- `contract_documents`: stored artifacts (private storage keys)
- `counterparties`: external parties per tenant
- `contract_types`, `contract_categories`: classification dimensions
- `clause_library`, `contract_templates`: drafting building blocks
- `custom_fields`: tenant-defined metadata schema

Governance & collaboration:
- `approval_workflows`, `approval_workflow_steps`: approval definitions
- `approval_steps`: runtime approvals and who/when/decision
- `audit_logs`: append-only audit trail
- `comments`: collaboration threads/notes
- `tasks`: obligations, follow-ups, renewals
- `notifications`: user notifications

AI & automation:
- `ai_configs`: tenant AI settings (models/flags/provider config)
- `analysis_requests`: traceable AI requests and results
- `contract_embeddings`: RAG vectors + chunks (pgvector)

Integrations:
- `webhooks`: event subscriptions per tenant
- `webhook_deliveries`: outbox + delivery log
- `external_identities`: canonical mapping to CRM/ERP identifiers

Billing (optional):
- `plans`: global plan catalog
- `company_subscriptions`: subscription status per tenant
- `billing_events`: event log for subscription changes
- `invoices`: billing provider outputs (read-only to end users)

---

## 7) Security model (how isolation is enforced)

Row Level Security (RLS):
- Most business tables have RLS enabled with policies that:
  - allow members to SELECT tenant-scoped rows,
  - allow admins to manage configuration tables,
  - restrict sensitive tables (e.g., `audit_logs`) to trusted writers.

Structural tenant integrity:
- Some tables use composite constraints / FK patterns to ensure a row cannot point across tenants (e.g., contract-scoped embeddings and versions).

Storage security (documents):
- Bucket `contracts` is private.
- Policies validate the key's first segment is a UUID and that the caller is a member/admin of that company.

Trusted code boundaries (service role):
- Certain writes should come only from privileged services:
  - `audit_logs` inserts
  - `webhook_deliveries` writes / state transitions
  - `contract_embeddings` writes (in many deployments)
  - subscription/billing updates (demo does this in `subscription-manager`)

---

## 8) Interfaces: RPCs and Edge Functions

Database RPCs (onboarding), defined in `migrations/0001_auth_onboarding.sql`:
- `public.ensure_user_profile()` (SECURITY DEFINER)
- `public.create_company_and_join(p_company_name text)` (authenticated EXECUTE)
- `public.join_company_by_invite_code(p_invite_code text)` (authenticated EXECUTE)

Edge Function: subscription-manager
- Path: `supabase/functions/subscription-manager/index.ts`
- Requires `Authorization: Bearer <user_access_token>`
- Verifies the caller is an admin in `company_users` for the `company_id`
- Performs subscription writes using the service role key (demo pattern)

Request payload:
```json
{
  "action": "create_subscription|change_plan|cancel_subscription",
  "company_id": "<uuid>",
  "plan_id": "basic|real_estate",
  "payment_method_id": "..."
}
```

---

## 9) Setup and local run (from current repo)

Install schema + policies (Supabase SQL editor or migrations). Run scripts in the order documented in `README_ENTERPRISE_CLM.md`:
1. `schema_UPDATED_ENTERPRISE.sql`
2. `schema_ENTERPRISE_CLM_REFERENCE_V2.sql`
3. `schema_BILLING_ENTERPRISE.sql` (optional)
4. `rls_UPDATED_ENTERPRISE.sql`
5. `rls_ENTERPRISE_CLM_REFERENCE_V2.sql`
6. `rls_BILLING_ENTERPRISE.sql` (optional)
7. `migrations/0001_auth_onboarding.sql`

Run the UI locally:
```bash
npm install
npm run dev
```

Useful pages:
- Landing: `http://localhost:5173/index.html`
- Sign up: `http://localhost:5173/auth/signup.html`
- App: `http://localhost:5173/app/index.html`
- Billing: from the App page (Billing per company)

Tests:
```bash
npm test
```

---

## 10) Delivery plan (roadmap)

This roadmap matches the schema's intent and the Not included items called out in the repo docs.

Phase 0 - Baseline (already in repo)
- Multi-tenant schema + RLS + private document storage pattern
- Onboarding RPCs + minimal auth UI
- Billing demo tables + subscription-manager Edge Function

Phase 1 - Core CLM UI (MVP)
- Contract CRUD (`contracts`) and versioning UI (`contract_versions`)
- Counterparty management (`counterparties`)
- Document upload/download (signed URLs or proxy) and metadata (`contract_documents`)
- Comments + tasks (`comments`, `tasks`) and basic notifications (`notifications`)

Phase 2 - Workflow & governance
- Approval workflow designer UI (`approval_workflows`, `approval_workflow_steps`)
- Runtime approvals UI (`approval_steps`)
- Trusted audit log writer (service role) and standardized who/what/when events (`audit_logs`)

Phase 3 - Integrations & reliability
- Webhook configuration UI (`webhooks`)
- Webhook dispatcher/worker processing `webhook_deliveries` with retries, signatures, and observability
- External identity ingestion + mapping (`external_identities`)

Phase 4 - AI and search
- AI request UI backed by `analysis_requests`
- Document ingestion + embedding pipeline writing `contract_embeddings`
- Semantic search + contract Q&A (RAG) with strict tenant boundaries

Phase 5 - Enterprise hardening
- SSO setup UX (`sso_connections`)
- Fine-grained RBAC expansion (`roles`)
- Analytics dashboards, retention policies, and operational runbooks

---

## Appendix A) Repository map (quick links)

- Master setup + context: `README_ENTERPRISE_CLM.md`
- Design constraints (baseline): `CONTEXT_ENTERPRISE_CLM.md`
- Table-by-table DB reference: `DATABASE_REFERENCE_ENTERPRISE_CLM.md`
- Onboarding migration: `migrations/0001_auth_onboarding.sql`
- Billing Edge Function: `supabase/functions/subscription-manager/index.ts`
- App pages: `app/index.html`, `app/subscription.html`
- Auth pages: `auth/signup.html`, `auth/login.html`, `auth/callback.html`

