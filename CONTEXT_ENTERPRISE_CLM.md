# CONTEXT: Enterprise CLM (Database & Security)

Updated: 2025-12-13

This file is a working context document to keep your database design and security model consistent.

## Non-negotiables (enterprise baseline)

1. **Tenant isolation is mandatory**
   - Every tenant-owned table has `company_id`.
   - RLS must enforce membership checks via `public.is_company_member(company_id)` and admin checks via `public.is_company_admin(company_id)`.

2. **Contract documents are private**
   - No public bucket access for contract files.
   - DB stores storage paths, not public URLs.

3. **Auditability**
   - Audit logs are append-only from trusted server-side code.
   - Approval steps and status transitions must be traceable.

4. **Integration reliability**
   - Webhooks use an outbox/delivery log to support retries and incident investigation.

## Storage path convention

Bucket: `contracts` (private)

Recommended object name pattern:
- `<company_id>/contracts/<contract_id>/<document_id>.<ext>`

RLS policies enforce that the first path segment is a UUID and that the user is a member/admin of that company.

## AI layer conventions

- `analysis_requests`: tenant-scoped (company_id required), user-owned
- `contract_embeddings`: tenant-scoped and contract-scoped; writes are typically done by trusted code (service role/Edge Functions)

## Operational notes

- Prefer running schema changes as migrations (idempotent SQL).
- Keep RLS policies in version control and treat them as part of your application logic.
