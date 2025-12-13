-- =====================================================================================
-- Enterprise CLM Database Reference (RLS Patch) - v2
-- Updated: 2025-12-13
--
-- Run AFTER rls_UPDATED_ENTERPRISE.sql
-- Adds RLS for:
--   - contract_embeddings (pgvector)
--   - webhooks + webhook_deliveries
--   - sso_connections
--   - external_identities
-- Tightens:
--   - contract_versions / contract_documents tenant consistency
--   - analysis_requests must be tenant-scoped (company_id required)
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1) Tighten existing tables: versions / documents / analysis_requests
-- -------------------------------------------------------------------------------------

-- contract_versions: require company_id matches parent contract
DROP POLICY IF EXISTS "contract_versions_select_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_insert_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_update_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_delete_admin" ON public.contract_versions;

CREATE POLICY "contract_versions_select_member"
ON public.contract_versions
FOR SELECT
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
);

CREATE POLICY "contract_versions_insert_member"
ON public.contract_versions
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
  AND (author_id IS NULL OR author_id = auth.uid())
);

CREATE POLICY "contract_versions_update_member"
ON public.contract_versions
FOR UPDATE
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
)
WITH CHECK (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
);

CREATE POLICY "contract_versions_delete_admin"
ON public.contract_versions
FOR DELETE
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_admin(company_id)
);

-- contract_documents: require company_id matches parent + require private storage_path
DROP POLICY IF EXISTS "contract_documents_select_member" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_insert_member" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_update_owner_or_admin" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_delete_owner_or_admin" ON public.contract_documents;

CREATE POLICY "contract_documents_select_member"
ON public.contract_documents
FOR SELECT
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
);

CREATE POLICY "contract_documents_insert_member"
ON public.contract_documents
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
  AND storage_path IS NOT NULL
  AND storage_path <> ''
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);

CREATE POLICY "contract_documents_update_owner_or_admin"
ON public.contract_documents
FOR UPDATE
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
  AND (
    uploaded_by = auth.uid()
    OR public.is_company_admin(company_id)
  )
)
WITH CHECK (
  company_id = public.company_id_for_contract(contract_id)
  AND public.is_company_member(company_id)
  AND storage_path IS NOT NULL
  AND storage_path <> ''
  AND (
    uploaded_by = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

CREATE POLICY "contract_documents_delete_owner_or_admin"
ON public.contract_documents
FOR DELETE
TO authenticated
USING (
  company_id = public.company_id_for_contract(contract_id)
  AND (
    uploaded_by = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

-- analysis_requests: require company_id (enterprise tenant scoping)
DROP POLICY IF EXISTS "analysis_requests_select_self_or_admin" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_insert_self" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_update_self_or_admin" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_delete_self_or_admin" ON public.analysis_requests;

CREATE POLICY "analysis_requests_select_self_or_admin"
ON public.analysis_requests
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.is_company_member(company_id)
  AND (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

CREATE POLICY "analysis_requests_insert_self"
ON public.analysis_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id IS NOT NULL
  AND public.is_company_member(company_id)
);

CREATE POLICY "analysis_requests_update_self_or_admin"
ON public.analysis_requests
FOR UPDATE
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.is_company_member(company_id)
  AND (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  )
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.is_company_member(company_id)
  AND (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  )
);

CREATE POLICY "analysis_requests_delete_self_or_admin"
ON public.analysis_requests
FOR DELETE
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.is_company_admin(company_id)
);

-- -------------------------------------------------------------------------------------
-- 2) New table: contract_embeddings
-- -------------------------------------------------------------------------------------

ALTER TABLE public.contract_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings_select_member" ON public.contract_embeddings;
DROP POLICY IF EXISTS "embeddings_manage_admin" ON public.contract_embeddings;

CREATE POLICY "embeddings_select_member"
ON public.contract_embeddings
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "embeddings_manage_admin"
ON public.contract_embeddings
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- -------------------------------------------------------------------------------------
-- 3) New tables: webhooks + webhook_deliveries
-- -------------------------------------------------------------------------------------

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhooks_select_member" ON public.webhooks;
DROP POLICY IF EXISTS "webhooks_manage_admin" ON public.webhooks;

CREATE POLICY "webhooks_select_member"
ON public.webhooks
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "webhooks_manage_admin"
ON public.webhooks
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- Delivery records should not be editable by end-users.
-- Allow read for members; restrict writes to trusted server-side code.
DROP POLICY IF EXISTS "webhook_deliveries_select_member" ON public.webhook_deliveries;

CREATE POLICY "webhook_deliveries_select_member"
ON public.webhook_deliveries
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

REVOKE INSERT, UPDATE, DELETE ON public.webhook_deliveries FROM authenticated;

-- -------------------------------------------------------------------------------------
-- 4) New table: sso_connections
-- -------------------------------------------------------------------------------------

ALTER TABLE public.sso_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sso_connections_select_member" ON public.sso_connections;
DROP POLICY IF EXISTS "sso_connections_manage_admin" ON public.sso_connections;

CREATE POLICY "sso_connections_select_member"
ON public.sso_connections
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "sso_connections_manage_admin"
ON public.sso_connections
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

-- -------------------------------------------------------------------------------------
-- 5) New table: external_identities
-- -------------------------------------------------------------------------------------

ALTER TABLE public.external_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "external_identities_select_member" ON public.external_identities;
DROP POLICY IF EXISTS "external_identities_manage_admin" ON public.external_identities;

CREATE POLICY "external_identities_select_member"
ON public.external_identities
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "external_identities_manage_admin"
ON public.external_identities
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));

COMMIT;
