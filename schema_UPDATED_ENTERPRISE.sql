-- This schema is for context and setup. It should be run in the Supabase SQL editor.

-- Custom ENUM Types
-- matches types.ts and existing DB enums

-- Risk Level (Capitalized values as per DB and types.ts)
CREATE TYPE public.risk_level AS ENUM (
    'High',
    'Medium',
    'Low',
    'Unknown'
);

-- Contract Status (snake_case values, matches 'contract_status_enum' in DB)
CREATE TYPE public.contract_status_enum AS ENUM (
    'draft',
    'in_review',
    'pending_approval',
    'sent_for_signature',
    'fully_executed',
    'active',
    'expired',
    'terminated',
    'superseded',
    'archived'
);

-- Contract Type Category (Not in DB dump, needs creation)
CREATE TYPE public.contract_type_category AS ENUM (
    'Business Function Category',
    'Spend Category',
    'Legal Agreement Type'
);

-- Approval Status
CREATE TYPE public.approval_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'skipped',
    'canceled'
);

-- Audit Action Type
CREATE TYPE public.audit_action_type_enum AS ENUM (
    'created',
    'updated',
    'deleted',
    'status_changed',
    'field_changed',
    'comment_added',
    'file_uploaded',
    'file_deleted',
    'approval_submitted',
    'approval_decided',
    'login',
    'logout',
    'other'
);

-- Audit Entity Type
CREATE TYPE public.audit_entity_type_enum AS ENUM (
    'contract',
    'contract_version',
    'contract_document',
    'counterparty',
    'approval_step',
    'task',
    'comment',
    'company',
    'user',
    'role',
    'company_setting',
    'other'
);

-- Counterparty Type
CREATE TYPE public.counterparty_type_enum AS ENUM (
    'vendor',
    'customer',
    'partner',
    'landlord',
    'tenant',
    'consultant',
    'other'
);

-- Signature Status
CREATE TYPE public.signature_status_enum AS ENUM (
    'not_required',
    'not_started',
    'pending_signature',
    'partially_signed',
    'fully_signed',
    'declined',
    'canceled'
);

-- Task Status
CREATE TYPE public.task_status_enum AS ENUM (
    'open',
    'in_progress',
    'blocked',
    'done',
    'canceled'
);

-- Task Type
CREATE TYPE public.task_type_enum AS ENUM (
    'review',
    'approval',
    'renewal',
    'signature',
    'follow_up',
    'data_cleanup',
    'other'
);


-- Table for public user profiles, linked to auth.users
CREATE TABLE public.users (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table for applications (if this CLM is part of a multi-app ecosystem)
CREATE TABLE public.apps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT apps_pkey PRIMARY KEY (id)
);

-- Table for companies (tenants)
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  app_id uuid,
  logo_url text,
  primary_contact_email text,
  default_currency text,
  default_timezone text,
  industry text,
  created_by_user_id uuid,
  invite_code text UNIQUE DEFAULT substring(md5(random()::text), 0, 9),
  is_onboarding_completed boolean DEFAULT false,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id),
  CONSTRAINT companies_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id)
);

-- Table for company-specific roles
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  permissions_json jsonb,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Join table for users and companies
-- Table for company departments
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  parent_department_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT departments_parent_department_id_fkey FOREIGN KEY (parent_department_id) REFERENCES public.departments(id)
);

CREATE TABLE public.company_users (
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_id uuid,
  is_admin boolean DEFAULT false,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  department_id uuid,
  CONSTRAINT company_users_pkey PRIMARY KEY (id),
  CONSTRAINT company_users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id), -- ensure public.users reference
  CONSTRAINT company_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT company_users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);

-- Table for company-specific contract types
CREATE TABLE public.contract_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category public.contract_type_category DEFAULT 'Business Function Category'::public.contract_type_category,
  CONSTRAINT contract_types_pkey PRIMARY KEY (id),
  CONSTRAINT contract_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for contract categories
CREATE TABLE public.contract_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contract_categories_pkey PRIMARY KEY (id),
  CONSTRAINT contract_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for counterparties
CREATE TABLE public.counterparties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  type public.counterparty_type_enum,
  contact_info jsonb,
  risk_rating public.risk_level DEFAULT 'Unknown'::public.risk_level,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT counterparties_pkey PRIMARY KEY (id),
  CONSTRAINT counterparties_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Core contracts table
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status public.contract_status_enum DEFAULT 'draft'::public.contract_status_enum,
  owner_id uuid,
  counterparty_id uuid,
  counterparty_name text,
  effective_date date,
  end_date date,
  auto_renew boolean DEFAULT false,
  renewal_term_months integer,
  total_value numeric,
  currency text DEFAULT 'USD'::text,
  risk_level public.risk_level DEFAULT 'Unknown'::public.risk_level,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  app_id uuid,
  contract_number text,
  contract_type_id uuid,
  category_id uuid,
  department_id uuid,
  renewal_notice_days integer,
  parent_contract_id uuid,
  governing_law text,
  signature_status public.signature_status_enum,
  archived_at timestamp with time zone,
  content text,
  CONSTRAINT contracts_pkey PRIMARY KEY (id),
  CONSTRAINT contracts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT contracts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id),
  CONSTRAINT contracts_counterparty_id_fkey FOREIGN KEY (counterparty_id) REFERENCES public.counterparties(id),
  CONSTRAINT contracts_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id),
  CONSTRAINT contracts_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.contract_types(id),
  CONSTRAINT contracts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.contract_categories(id),
  CONSTRAINT contracts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT contracts_parent_contract_id_fkey FOREIGN KEY (parent_contract_id) REFERENCES public.contracts(id)
);

-- Table for different versions of a contract
CREATE TABLE public.contract_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  version_number integer NOT NULL,
  status public.contract_status_enum NOT NULL DEFAULT 'draft'::public.contract_status_enum,
  source_file_url text,
  generated_by_ai boolean DEFAULT false,
  author_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  signed_at timestamp with time zone,
  superseded_by_version_id uuid,
  summary text,
  diff_summary text,
  content text,
  CONSTRAINT contract_versions_pkey PRIMARY KEY (id),
  CONSTRAINT contract_versions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT contract_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id),
  CONSTRAINT contract_versions_superseded_by_version_id_fkey FOREIGN KEY (superseded_by_version_id) REFERENCES public.contract_versions(id)
);

-- Table for documents associated with a contract
CREATE TABLE public.contract_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  version_id uuid,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  storage_bucket text,
  uploaded_by uuid,
  uploaded_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  file_size_bytes bigint,
  CONSTRAINT contract_documents_pkey PRIMARY KEY (id),
  CONSTRAINT contract_documents_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT contract_documents_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.contract_versions(id),
  CONSTRAINT contract_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

-- Clause library for reusable clauses
CREATE TABLE public.clause_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text,
  title text NOT NULL,
  body text NOT NULL,
  risk_level text,
  tags text[],
  language text,
  jurisdiction text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT clause_library_pkey PRIMARY KEY (id),
  CONSTRAINT clause_library_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT clause_library_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Contract templates
CREATE TABLE public.contract_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  contract_type_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  body text NOT NULL,
  is_default boolean DEFAULT false,
  language text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT contract_templates_pkey PRIMARY KEY (id),
  CONSTRAINT contract_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT contract_templates_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.contract_types(id),
  CONSTRAINT contract_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Approval workflows
CREATE TABLE public.approval_workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  applies_to_min_amount numeric,
  is_default boolean DEFAULT false,
  contract_type_id uuid,
  description text,
  applies_to_max_amount numeric,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT approval_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT approval_workflows_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT approval_workflows_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.contract_types(id),
  CONSTRAINT approval_workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Steps within an approval workflow
CREATE TABLE public.approval_workflow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  step_order integer NOT NULL,
  approver_role text,
  approver_user_id uuid,
  sla_hours integer,
  min_amount numeric,
  max_amount numeric,
  auto_approve_if_below_threshold boolean DEFAULT false,
  CONSTRAINT approval_workflow_steps_pkey PRIMARY KEY (id),
  CONSTRAINT approval_workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id),
  CONSTRAINT approval_workflow_steps_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id)
);

-- Instances of an approval step for a specific contract
CREATE TABLE public.approval_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  version_id uuid NOT NULL,
  workflow_step_id uuid NOT NULL,
  approver_id uuid,
  status public.approval_status_enum NOT NULL,
  comment text,
  approved_at timestamp with time zone,
  company_id uuid,
  workflow_id uuid,
  role_at_time text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT approval_steps_pkey PRIMARY KEY (id),
  CONSTRAINT approval_instances_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT approval_instances_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.contract_versions(id),
  CONSTRAINT approval_instances_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.approval_workflow_steps(id),
  CONSTRAINT approval_instances_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id),
  CONSTRAINT approval_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id)
);

-- Audit logs for tracking changes
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  actor_id uuid,
  entity_type public.audit_entity_type_enum NOT NULL,
  entity_id uuid,
  action public.audit_action_type_enum NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  actor_email text,
  ip_address text,
  user_agent text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);

-- Table for AI-related configurations per company
CREATE TABLE public.ai_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  drafting_tone text DEFAULT 'formal'::text,
  high_risk_clauses text[],
  risk_scoring_rules jsonb,
  language_preferences text[],
  CONSTRAINT ai_configs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_configs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for comments on contracts
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  version_id uuid,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_internal boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  highlight_id text,
  quote_text text,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT comments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT comments_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.contract_versions(id),
  CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id)
);

-- Table for company-level settings
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_settings_pkey PRIMARY KEY (id),
  CONSTRAINT company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_settings_company_id_key_unique UNIQUE (company_id, key)
);

-- Table for custom fields
CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  data_type text NOT NULL,
  is_required boolean DEFAULT false,
  options_json jsonb,
  help_text text,
  sort_order integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT custom_fields_pkey PRIMARY KEY (id),
  CONSTRAINT custom_fields_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for expense types
CREATE TABLE public.expense_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expense_types_pkey PRIMARY KEY (id),
  CONSTRAINT expense_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for tasks related to contracts
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  contract_id uuid,
  type public.task_type_enum,
  title text NOT NULL,
  description text,
  assignee_id uuid,
  due_date date,
  completed_at timestamp with time zone,
  status public.task_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT tasks_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Table for properties
CREATE TABLE public.properties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT properties_pkey PRIMARY KEY (id),
  CONSTRAINT properties_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- Table for logging contract analysis requests
CREATE TABLE public.analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  file_name TEXT,
  file_path TEXT,
  status TEXT
);

-- Table for notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean DEFAULT false,
  type text, -- 'info', 'success', 'warning', 'error'
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- =====================================================================================
-- ENTERPRISE HARDENING PATCH (Recommended)
-- Add constraints, indexes, and consistency helpers for multi-tenant + audit-grade usage.
-- Apply AFTER the base schema above. Review carefully for existing production data.
-- =====================================================================================

-- 1) Prevent duplicate memberships per company
ALTER TABLE public.company_users
  ADD CONSTRAINT company_users_company_id_user_id_unique UNIQUE (company_id, user_id);

-- 2) Enforce unique version numbers per contract
ALTER TABLE public.contract_versions
  ADD CONSTRAINT contract_versions_contract_id_version_number_unique UNIQUE (contract_id, version_number);

-- 3) Improve tenant-scoped lookup performance (indexes)
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract_id ON public.contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON public.contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_comments_company_id ON public.comments(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_company_id ON public.approval_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);

-- 4) Analysis requests: make tenant-aware and consistent with public.users (recommended migration)
-- NOTE: if you already have rows, add the column first, backfill company_id, then enforce NOT NULL.
ALTER TABLE public.analysis_requests
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- Replace the auth.users FK with public.users for consistency (optional but recommended)
ALTER TABLE public.analysis_requests
  DROP CONSTRAINT IF EXISTS analysis_requests_user_id_fkey;

ALTER TABLE public.analysis_requests
  ADD CONSTRAINT analysis_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.analysis_requests
  ADD CONSTRAINT analysis_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_analysis_requests_company_id ON public.analysis_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_id ON public.analysis_requests(user_id);

-- 5) Contract documents: store PRIVATE storage paths (do not store public URLs)
-- Keep file_url for backward compatibility, but prefer storage_path going forward.
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 6) Recommended: ensure workflow steps are unique per workflow order
ALTER TABLE public.approval_workflow_steps
  ADD CONSTRAINT approval_workflow_steps_workflow_id_step_order_unique UNIQUE (workflow_id, step_order);

-- 7) Optional: soft-delete pattern (enterprise auditability)
-- You already have archived_at on contracts; consider adding deleted_at columns to other entities
-- and enforce deletes via UPDATE (soft delete) rather than DELETE.

-- 8) Auto-add the company creator as an active admin member (recommended)
CREATE OR REPLACE FUNCTION public.add_creator_to_company_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the creator exists in company_users as an admin
  IF NEW.created_by_user_id IS NOT NULL THEN
    INSERT INTO public.company_users (company_id, user_id, is_admin, is_active, joined_at)
    VALUES (NEW.id, NEW.created_by_user_id, true, true, now())
    ON CONFLICT (company_id, user_id) DO UPDATE
      SET is_admin = true,
          is_active = true,
          joined_at = COALESCE(public.company_users.joined_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_creator_to_company_users ON public.companies;
CREATE TRIGGER trg_add_creator_to_company_users
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_to_company_users();
