# Enterprise CLM Database Reference

Updated: 2025-12-13

This document is the **database reference** for an enterprise Contract Lifecycle Management (CLM) application.

---

## 1) Tenancy model

**Tenant = company** (`public.companies`)

Users belong to companies through `public.company_users`.
All tenant-owned rows must be scoped by `company_id` and protected by RLS.

**RLS helpers (required):**
- `public.is_company_member(company_id uuid) -> boolean`
- `public.is_company_admin(company_id uuid) -> boolean`

---

## 2) Core entity tables

### Companies & membership
- `companies` — tenant root.
- `roles` — tenant-scoped RBAC roles.
- `company_users` — membership join (must be unique per `(company_id, user_id)`).

### Contracts
- `contracts` — main contract record (status, dates, owner, counterparty, value, renewal fields).
- `contract_versions` — immutable-ish versions; tenant consistency enforced via `(contract_id, company_id)`.
- `contract_documents` — uploaded files; stores **private storage path** (`storage_path`).

### Counterparties
- `counterparties` — vendor/customer/partner entities (tenant-scoped).

---

## 3) Workflow & governance tables

### Approvals
- `approval_workflows`
- `approval_workflow_steps`
- `approval_steps`

Conventions:
- approval definitions are tenant-scoped (`company_id`).
- runtime steps tie to a contract/version and record who approved/when.

### Audit
- `audit_logs` is **append-only** (write via trusted server-side code only).

---

## 4) Collaboration & operations

- `comments` — contract/version comments (supports internal notes).
- `tasks` — follow-ups and obligations (recommended for renewals, deliverables, compliance actions).
- `notifications` — user notifications (tenant-aware).

---

## 5) AI layer

### Requests
- `analysis_requests`
  - **must include `company_id`**
  - `user_id` is the requester
  - store inputs/outputs/errors for traceability

### Embeddings (RAG / semantic search)
- `contract_embeddings`
  - enforced tenant scope (`company_id`)
  - enforced contract scope via composite FK `(contract_id, company_id)`
  - stores chunk content, hash (dedupe), embedding vector, model metadata

**Indexing note:** vector indexes (IVFFlat/HNSW) are optional and should be enabled once you confirm pgvector capabilities and tune parameters.

---

## 6) Integrations

### Webhooks
- `webhooks` — subscriptions per company (events, URL, secret, active flag)
- `webhook_deliveries` — delivery outbox + log (status, retries, errors, responses)

Security:
- members can read deliveries
- delivery writes are restricted to trusted server-side code

---

## 7) Enterprise IT / IAM

### SSO
- `sso_connections`
  - provider: `saml` / `oidc`
  - domains: list of verified email domains
  - settings: IdP metadata/config JSON

### External identity mapping
- `external_identities`
  - `(company_id, provider, entity_type, external_id)` is unique
  - `(company_id, provider, entity_type, entity_id)` is unique

Use this for Salesforce/ERP IDs where uniqueness matters.

---

## 8) Storage model (Supabase Storage)

Bucket:
- `contracts` (private)

Object key convention:
- `<company_id>/contracts/<contract_id>/<document_id>.<ext>`

Database column:
- `contract_documents.storage_path` stores the object key.

Access:
- use signed URLs or server-side proxy (Edge Function).
