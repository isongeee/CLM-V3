# Supabase setup (Enterprise CLM v2)

## Run order (required)
1. Run `supabase/schema_UPDATED_ENTERPRISE_v2.sql`
2. Run `supabase/rls_UPDATED_ENTERPRISE_v2.sql`

## Notes
- The RLS script hardens access and creates tenant-safe helper functions (e.g. `has_company_permission`).
- The Storage bucket `contracts` is enforced as **PRIVATE**; contract files must be stored under:
  - `<company_id>/contracts/<contract_id>/<filename>`
  - Persist the object path in `contract_documents.storage_path` and use signed URLs for downloads.
- `audit_logs` are intended to be **write-only** from trusted server-side code (Edge Functions / service role).

## Local development (recommended)
- Install the Supabase CLI and run:
  - `supabase init`
  - `supabase start`
- Apply SQL in the Supabase SQL editor (or via migrations if you prefer).

