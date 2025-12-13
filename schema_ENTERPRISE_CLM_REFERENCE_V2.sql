-- =====================================================================================
-- Enterprise CLM Database Reference (Schema) - v2
-- Updated: 2025-12-13
--
-- This script is designed to be SAFE to run after schema_UPDATED_ENTERPRISE.sql
-- It applies enterprise hardening + adds missing enterprise feature tables:
-- - pgvector embeddings for RAG
-- - webhooks + delivery outbox
-- - SSO connections settings
-- - normalized external identities
-- - tenant integrity constraints on versioning & documents
--
-- NOTE: If you are starting a brand-new database, run your base schema first,
-- then run this v2 patch.
-- =====================================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------------------------------------------------
-- 0) Strengthen tenant integrity on existing tables
-- -------------------------------------------------------------------------------------

-- 0a) Allow composite foreign keys that enforce (contract_id, company_id) consistency.
ALTER TABLE public.contracts
  ADD CONSTRAINT IF NOT EXISTS contracts_id_company_unique UNIQUE (id, company_id);

-- 0b) contract_versions: add company_id + enforce it matches parent contract
ALTER TABLE public.contract_versions
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.contract_versions v
SET company_id = c.company_id
FROM public.contracts c
WHERE v.company_id IS NULL AND v.contract_id = c.id;

DO $$
BEGIN
  -- Only set NOT NULL if there are no NULLs remaining
  IF NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE company_id IS NULL) THEN
    ALTER TABLE public.contract_versions
      ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Replace the old single-column FK with a composite FK (enforces tenant consistency)
ALTER TABLE public.contract_versions
  DROP CONSTRAINT IF EXISTS contract_versions_contract_company_fkey;

ALTER TABLE public.contract_versions
  ADD CONSTRAINT contract_versions_contract_company_fkey
  FOREIGN KEY (contract_id, company_id)
  REFERENCES public.contracts(id, company_id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contract_versions_company_id ON public.contract_versions(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract_id ON public.contract_versions(contract_id);

-- 0c) contract_documents: make company_id required + add storage_path as canonical reference
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.contract_documents d
SET company_id = c.company_id
FROM public.contracts c
WHERE d.company_id IS NULL AND d.contract_id = c.id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contract_documents WHERE company_id IS NULL) THEN
    ALTER TABLE public.contract_documents
      ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Canonical storage path (private bucket) e.g. '<company_id>/contracts/<contract_id>/<document_id>.pdf'
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

UPDATE public.contract_documents
SET storage_path = file_url
WHERE storage_path IS NULL AND file_url IS NOT NULL;

-- storage_path should be required for new rows (enforced by app + RLS)
ALTER TABLE public.contract_documents
ALTER TABLE public.contract_documents
  ALTER COLUMN storage_path DROP DEFAULT;

-- Deprecate public URL usage: allow file_url to be NULL (legacy compatibility)
ALTER TABLE public.contract_documents
  ALTER COLUMN file_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_documents_company_id ON public.contract_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON public.contract_documents(contract_id);

-- 0d) analysis_requests: add company_id for tenant isolation (recommended to backfill)
ALTER TABLE public.analysis_requests
  ADD COLUMN IF NOT EXISTS company_id uuid;

CREATE INDEX IF NOT EXISTS idx_analysis_requests_company_id ON public.analysis_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_id ON public.analysis_requests(user_id);

-- 0e) Add "external_ids" JSONB for quick compatibility (normalized table is added below)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sso_settings jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.counterparties
  ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}'::jsonb;

-- -------------------------------------------------------------------------------------
-- 1) Enterprise AI Layer: Embeddings (RAG / semantic search)
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL,
  contract_version_id uuid,
  chunk_index integer NOT NULL,
  chunk_content text NOT NULL,
  chunk_hash text,
  embedding vector(1536) NOT NULL,
  embedding_model text,
  embedding_dim integer NOT NULL DEFAULT 1536,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT contract_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT contract_embeddings_contract_company_fkey
    FOREIGN KEY (contract_id, company_id)
    REFERENCES public.contracts(id, company_id)
    ON DELETE CASCADE,
  CONSTRAINT contract_embeddings_contract_version_fkey
    FOREIGN KEY (contract_version_id) REFERENCES public.contract_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_embeddings_company_id ON public.contract_embeddings(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id ON public.contract_embeddings(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_embeddings_chunk_hash ON public.contract_embeddings(chunk_hash);

-- Optional vector index (enable after you confirm pgvector supports it in your environment):
--   1) IVFFlat (needs ANALYZE; best for large datasets)
-- CREATE INDEX IF NOT EXISTS idx_contract_embeddings_embedding_ivfflat
--   ON public.contract_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--   2) HNSW (fast + good recall)
-- CREATE INDEX IF NOT EXISTS idx_contract_embeddings_embedding_hnsw
--   ON public.contract_embeddings USING hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------------------------------------
-- 2) Enterprise Integrations Layer: Webhooks + Delivery Outbox
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_delivery_status_enum') THEN
    CREATE TYPE public.webhook_delivery_status_enum AS ENUM (
      'pending',
      'sending',
      'succeeded',
      'failed',
      'dead_letter',
      'disabled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text,
  url text NOT NULL,
  -- NOTE: In a strict enterprise setup, store this encrypted or in a vault.
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  rotated_at timestamptz,
  CONSTRAINT webhooks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_webhooks_company_id ON public.webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON public.webhooks(company_id, is_active);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status public.webhook_delivery_status_enum NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  response_status integer,
  response_body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_company_id ON public.webhook_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status, next_retry_at);

-- Simple updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated_at ON public.webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_updated_at
BEFORE UPDATE ON public.webhook_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 3) Enterprise IT Layer: SSO Connections
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sso_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL, -- e.g. 'saml', 'oidc'
  domains text[] DEFAULT '{}'::text[], -- verified email domains
  settings jsonb NOT NULL DEFAULT '{}'::jsonb, -- IdP metadata / config
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sso_connections_pkey PRIMARY KEY (id),
  CONSTRAINT sso_connections_unique_provider UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_sso_connections_company_id ON public.sso_connections(company_id);

DROP TRIGGER IF EXISTS trg_sso_connections_updated_at ON public.sso_connections;
CREATE TRIGGER trg_sso_connections_updated_at
BEFORE UPDATE ON public.sso_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 4) Enterprise Data Interop Layer: Normalized External Identities
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_identities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL, -- e.g. 'salesforce', 'netsuite'
  entity_type text NOT NULL, -- e.g. 'contract', 'counterparty', 'user'
  entity_id uuid NOT NULL, -- points to the internal UUID
  external_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  CONSTRAINT external_identities_pkey PRIMARY KEY (id),
  CONSTRAINT external_identities_unique_external UNIQUE (company_id, provider, entity_type, external_id),
  CONSTRAINT external_identities_unique_entity UNIQUE (company_id, provider, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_company_id ON public.external_identities(company_id);
CREATE INDEX IF NOT EXISTS idx_external_identities_lookup ON public.external_identities(provider, entity_type, external_id);

COMMIT;