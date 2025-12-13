-- =====================================================================================
-- RLS + STORAGE HARDENING (Enterprise-ready baseline)
-- - Private storage bucket + tenant-scoped policies
-- - Complete RLS coverage for all tables in schema_UPDATED_ENTERPRISE.sql
-- =====================================================================================

BEGIN;

-- 0) Baseline grants (RLS is the primary gate)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 1) Helper functions for tenant checks
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.user_id = auth.uid()
      AND cu.is_active = true
  );
$$;
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.user_id = auth.uid()
      AND cu.is_active = true
      AND cu.is_admin = true
  );
$$;
CREATE OR REPLACE FUNCTION public.company_id_for_contract(p_contract_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.company_id
  FROM public.contracts c
  WHERE c.id = p_contract_id;
$$;
CREATE OR REPLACE FUNCTION public.company_id_for_workflow(p_workflow_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.company_id
  FROM public.approval_workflows w
  WHERE w.id = p_workflow_id;
$$;
CREATE OR REPLACE FUNCTION public.safe_uuid_from_text(p_text text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_text::uuid
    ELSE NULL
  END;
$$;
CREATE OR REPLACE FUNCTION public.storage_company_id_from_path(p_object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.safe_uuid_from_text(split_part(p_object_name, '/', 1));
$$;

-- 2) PRIVATE storage bucket for contracts (no public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2a) Storage object policies (path must start with company_id/...)
DROP POLICY IF EXISTS "contracts_objects_select" ON storage.objects;
DROP POLICY IF EXISTS "contracts_objects_insert" ON storage.objects;
DROP POLICY IF EXISTS "contracts_objects_update" ON storage.objects;
DROP POLICY IF EXISTS "contracts_objects_delete" ON storage.objects;
CREATE POLICY "contracts_objects_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts'
  AND public.is_company_member(public.storage_company_id_from_path(name))
);
CREATE POLICY "contracts_objects_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts'
  AND public.is_company_member(public.storage_company_id_from_path(name))
  AND owner = auth.uid()
);
CREATE POLICY "contracts_objects_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contracts'
  AND public.is_company_member(public.storage_company_id_from_path(name))
  AND (owner = auth.uid() OR public.is_company_admin(public.storage_company_id_from_path(name)))
)
WITH CHECK (
  bucket_id = 'contracts'
  AND public.is_company_member(public.storage_company_id_from_path(name))
  AND (owner = auth.uid() OR public.is_company_admin(public.storage_company_id_from_path(name)))
);
CREATE POLICY "contracts_objects_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'contracts'
  AND public.is_company_member(public.storage_company_id_from_path(name))
  AND (owner = auth.uid() OR public.is_company_admin(public.storage_company_id_from_path(name)))
);

-- 3) Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_requests ENABLE ROW LEVEL SECURITY;

-- 4) Drop legacy/unknown policies (best-effort)
-- NOTE: If you previously created policies with different names, you may need to drop them manually.

DROP POLICY IF EXISTS "apps_select" ON public.apps;
CREATE POLICY "apps_select"
ON public.apps
FOR SELECT
TO authenticated
USING (true);
DROP POLICY IF EXISTS "users_select_self_or_company" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_select_self_or_company"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.company_users cu_me
    JOIN public.company_users cu_other
      ON cu_other.company_id = cu_me.company_id
    WHERE cu_me.user_id = auth.uid()
      AND cu_me.is_active = true
      AND cu_other.user_id = public.users.id
      AND cu_other.is_active = true
  )
);
CREATE POLICY "users_update_self"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "companies_select_member" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_creator" ON public.companies;
DROP POLICY IF EXISTS "companies_update_admin" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_admin" ON public.companies;
CREATE POLICY "companies_select_member"
ON public.companies
FOR SELECT
TO authenticated
USING (
  public.is_company_member(id)
);
CREATE POLICY "companies_insert_creator"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  created_by_user_id = auth.uid()
);
CREATE POLICY "companies_update_admin"
ON public.companies
FOR UPDATE
TO authenticated
USING (public.is_company_admin(id))
WITH CHECK (public.is_company_admin(id));
CREATE POLICY "companies_delete_admin"
ON public.companies
FOR DELETE
TO authenticated
USING (public.is_company_admin(id));
DROP POLICY IF EXISTS "company_users_select_member" ON public.company_users;
DROP POLICY IF EXISTS "company_users_insert_admin" ON public.company_users;
DROP POLICY IF EXISTS "company_users_update_admin" ON public.company_users;
DROP POLICY IF EXISTS "company_users_delete_admin" ON public.company_users;
CREATE POLICY "company_users_select_member"
ON public.company_users
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "company_users_insert_admin"
ON public.company_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "company_users_update_admin"
ON public.company_users
FOR UPDATE
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "company_users_delete_admin"
ON public.company_users
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "roles_select_member" ON public.roles;
DROP POLICY IF EXISTS "roles_manage_admin" ON public.roles;
CREATE POLICY "roles_select_member"
ON public.roles
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "roles_manage_admin"
ON public.roles
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "departments_select_member" ON public.departments;
DROP POLICY IF EXISTS "departments_manage_admin" ON public.departments;
CREATE POLICY "departments_select_member"
ON public.departments
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "departments_manage_admin"
ON public.departments
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "contract_types_select_member" ON public.contract_types;
DROP POLICY IF EXISTS "contract_types_manage_admin" ON public.contract_types;
CREATE POLICY "contract_types_select_member"
ON public.contract_types
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "contract_types_manage_admin"
ON public.contract_types
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "contract_categories_select_member" ON public.contract_categories;
DROP POLICY IF EXISTS "contract_categories_manage_admin" ON public.contract_categories;
CREATE POLICY "contract_categories_select_member"
ON public.contract_categories
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "contract_categories_manage_admin"
ON public.contract_categories
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "expense_types_select_member" ON public.expense_types;
DROP POLICY IF EXISTS "expense_types_manage_admin" ON public.expense_types;
CREATE POLICY "expense_types_select_member"
ON public.expense_types
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "expense_types_manage_admin"
ON public.expense_types
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "custom_fields_select_member" ON public.custom_fields;
DROP POLICY IF EXISTS "custom_fields_manage_admin" ON public.custom_fields;
CREATE POLICY "custom_fields_select_member"
ON public.custom_fields
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "custom_fields_manage_admin"
ON public.custom_fields
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "company_settings_select_member" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_manage_admin" ON public.company_settings;
CREATE POLICY "company_settings_select_member"
ON public.company_settings
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "company_settings_manage_admin"
ON public.company_settings
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "ai_configs_select_member" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_manage_admin" ON public.ai_configs;
CREATE POLICY "ai_configs_select_member"
ON public.ai_configs
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "ai_configs_manage_admin"
ON public.ai_configs
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "approval_workflows_select_member" ON public.approval_workflows;
DROP POLICY IF EXISTS "approval_workflows_manage_admin" ON public.approval_workflows;
CREATE POLICY "approval_workflows_select_member"
ON public.approval_workflows
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "approval_workflows_manage_admin"
ON public.approval_workflows
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "properties_select_member" ON public.properties;
DROP POLICY IF EXISTS "properties_manage_admin" ON public.properties;
CREATE POLICY "properties_select_member"
ON public.properties
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "properties_manage_admin"
ON public.properties
FOR ALL
TO authenticated
USING (public.is_company_admin(company_id))
WITH CHECK (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "counterparties_select_member" ON public.counterparties;
DROP POLICY IF EXISTS "counterparties_insert_member" ON public.counterparties;
DROP POLICY IF EXISTS "counterparties_update_member" ON public.counterparties;
DROP POLICY IF EXISTS "counterparties_delete_admin" ON public.counterparties;
CREATE POLICY "counterparties_select_member"
ON public.counterparties
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "counterparties_insert_member"
ON public.counterparties
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "counterparties_update_member"
ON public.counterparties
FOR UPDATE
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "counterparties_delete_admin"
ON public.counterparties
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "contracts_select_member" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert_member" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update_member" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete_admin" ON public.contracts;
CREATE POLICY "contracts_select_member"
ON public.contracts
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "contracts_insert_member"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "contracts_update_member"
ON public.contracts
FOR UPDATE
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "contracts_delete_admin"
ON public.contracts
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "contract_versions_select_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_insert_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_update_member" ON public.contract_versions;
DROP POLICY IF EXISTS "contract_versions_delete_admin" ON public.contract_versions;
CREATE POLICY "contract_versions_select_member"
ON public.contract_versions
FOR SELECT
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
);
CREATE POLICY "contract_versions_insert_member"
ON public.contract_versions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (author_id IS NULL OR author_id = auth.uid())
);
CREATE POLICY "contract_versions_update_member"
ON public.contract_versions
FOR UPDATE
TO authenticated
USING (public.is_company_member(public.company_id_for_contract(contract_id)))
WITH CHECK (public.is_company_member(public.company_id_for_contract(contract_id)));
CREATE POLICY "contract_versions_delete_admin"
ON public.contract_versions
FOR DELETE
TO authenticated
USING (public.is_company_admin(public.company_id_for_contract(contract_id)));
DROP POLICY IF EXISTS "contract_documents_select_member" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_insert_member" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_update_owner_or_admin" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_delete_owner_or_admin" ON public.contract_documents;
CREATE POLICY "contract_documents_select_member"
ON public.contract_documents
FOR SELECT
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
);
CREATE POLICY "contract_documents_insert_member"
ON public.contract_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);
CREATE POLICY "contract_documents_update_owner_or_admin"
ON public.contract_documents
FOR UPDATE
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (uploaded_by = auth.uid() OR public.is_company_admin(public.company_id_for_contract(contract_id)))
)
WITH CHECK (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (uploaded_by = auth.uid() OR public.is_company_admin(public.company_id_for_contract(contract_id)))
);
CREATE POLICY "contract_documents_delete_owner_or_admin"
ON public.contract_documents
FOR DELETE
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (uploaded_by = auth.uid() OR public.is_company_admin(public.company_id_for_contract(contract_id)))
);
DROP POLICY IF EXISTS "clause_library_select_member" ON public.clause_library;
DROP POLICY IF EXISTS "clause_library_insert_member" ON public.clause_library;
DROP POLICY IF EXISTS "clause_library_update_member" ON public.clause_library;
DROP POLICY IF EXISTS "clause_library_delete_admin" ON public.clause_library;
CREATE POLICY "clause_library_select_member"
ON public.clause_library
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "clause_library_insert_member"
ON public.clause_library
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "clause_library_update_member"
ON public.clause_library
FOR UPDATE
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "clause_library_delete_admin"
ON public.clause_library
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "contract_templates_select_member" ON public.contract_templates;
DROP POLICY IF EXISTS "contract_templates_insert_member" ON public.contract_templates;
DROP POLICY IF EXISTS "contract_templates_update_member" ON public.contract_templates;
DROP POLICY IF EXISTS "contract_templates_delete_admin" ON public.contract_templates;
CREATE POLICY "contract_templates_select_member"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "contract_templates_insert_member"
ON public.contract_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "contract_templates_update_member"
ON public.contract_templates
FOR UPDATE
TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "contract_templates_delete_admin"
ON public.contract_templates
FOR DELETE
TO authenticated
USING (public.is_company_admin(company_id));
DROP POLICY IF EXISTS "approval_workflow_steps_select_member" ON public.approval_workflow_steps;
DROP POLICY IF EXISTS "approval_workflow_steps_manage_admin" ON public.approval_workflow_steps;
CREATE POLICY "approval_workflow_steps_select_member"
ON public.approval_workflow_steps
FOR SELECT
TO authenticated
USING (
  public.is_company_member(public.company_id_for_workflow(workflow_id))
);
CREATE POLICY "approval_workflow_steps_manage_admin"
ON public.approval_workflow_steps
FOR ALL
TO authenticated
USING (
  public.is_company_admin(public.company_id_for_workflow(workflow_id))
)
WITH CHECK (
  public.is_company_admin(public.company_id_for_workflow(workflow_id))
);
DROP POLICY IF EXISTS "approval_steps_select_member" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_insert_member" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_update_approver_or_admin" ON public.approval_steps;
DROP POLICY IF EXISTS "approval_steps_delete_admin" ON public.approval_steps;
CREATE POLICY "approval_steps_select_member"
ON public.approval_steps
FOR SELECT
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
);
CREATE POLICY "approval_steps_insert_member"
ON public.approval_steps
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(public.company_id_for_contract(contract_id))
);
CREATE POLICY "approval_steps_update_approver_or_admin"
ON public.approval_steps
FOR UPDATE
TO authenticated
USING (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (
    approver_id = auth.uid()
    OR public.is_company_admin(public.company_id_for_contract(contract_id))
  )
)
WITH CHECK (
  public.is_company_member(public.company_id_for_contract(contract_id))
  AND (
    approver_id = auth.uid()
    OR public.is_company_admin(public.company_id_for_contract(contract_id))
  )
);
CREATE POLICY "approval_steps_delete_admin"
ON public.approval_steps
FOR DELETE
TO authenticated
USING (
  public.is_company_admin(public.company_id_for_contract(contract_id))
);
DROP POLICY IF EXISTS "comments_select_member" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_author" ON public.comments;
DROP POLICY IF EXISTS "comments_update_author_or_admin" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_author_or_admin" ON public.comments;
CREATE POLICY "comments_select_member"
ON public.comments
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "comments_insert_author"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(company_id)
  AND author_id = auth.uid()
);
CREATE POLICY "comments_update_author_or_admin"
ON public.comments
FOR UPDATE
TO authenticated
USING (
  public.is_company_member(company_id)
  AND (author_id = auth.uid() OR public.is_company_admin(company_id))
)
WITH CHECK (
  public.is_company_member(company_id)
  AND (author_id = auth.uid() OR public.is_company_admin(company_id))
);
CREATE POLICY "comments_delete_author_or_admin"
ON public.comments
FOR DELETE
TO authenticated
USING (
  public.is_company_member(company_id)
  AND (author_id = auth.uid() OR public.is_company_admin(company_id))
);
DROP POLICY IF EXISTS "tasks_select_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_creator" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_actor" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_creator_or_admin" ON public.tasks;
CREATE POLICY "tasks_select_member"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));
CREATE POLICY "tasks_insert_creator"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_member(company_id)
  AND (created_by IS NULL OR created_by = auth.uid())
);
CREATE POLICY "tasks_update_actor"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.is_company_member(company_id)
  AND (
    assignee_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_company_admin(company_id)
  )
)
WITH CHECK (
  public.is_company_member(company_id)
  AND (
    assignee_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_company_admin(company_id)
  )
);
CREATE POLICY "tasks_delete_creator_or_admin"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  public.is_company_member(company_id)
  AND (created_by = auth.uid() OR public.is_company_admin(company_id))
);
DROP POLICY IF EXISTS "notifications_select_self" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_self" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;
CREATE POLICY "notifications_select_self"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND public.is_company_member(company_id)
);
CREATE POLICY "notifications_insert_admin"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_admin(company_id)
);
CREATE POLICY "notifications_update_self"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.is_company_member(company_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.is_company_member(company_id)
);
CREATE POLICY "notifications_delete_admin"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  public.is_company_admin(company_id)
);
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_company_admin(company_id));
-- NOTE: Intentionally no INSERT/UPDATE/DELETE policies for audit_logs for authenticated users.
--       Write audit logs from trusted server-side code (service role / edge function).

DROP POLICY IF EXISTS "analysis_requests_select_self_or_admin" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_insert_self" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_update_self_or_admin" ON public.analysis_requests;
DROP POLICY IF EXISTS "analysis_requests_delete_self_or_admin" ON public.analysis_requests;
CREATE POLICY "analysis_requests_select_self_or_admin"
ON public.analysis_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (company_id IS NOT NULL AND public.is_company_admin(company_id))
);
CREATE POLICY "analysis_requests_insert_self"
ON public.analysis_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (company_id IS NULL OR public.is_company_member(company_id))
);
CREATE POLICY "analysis_requests_update_self_or_admin"
ON public.analysis_requests
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR (company_id IS NOT NULL AND public.is_company_admin(company_id))
)
WITH CHECK (
  user_id = auth.uid()
  OR (company_id IS NOT NULL AND public.is_company_admin(company_id))
);
CREATE POLICY "analysis_requests_delete_self_or_admin"
ON public.analysis_requests
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR (company_id IS NOT NULL AND public.is_company_admin(company_id))
);

-- 5) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
COMMIT;