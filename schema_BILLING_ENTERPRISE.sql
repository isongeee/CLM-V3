-- =====================================================================================
-- Billing / Subscriptions (Enterprise CLM)
-- Updated: 2025-12-13
--
-- Matches:
-- - app/subscription.js (reads company_subscriptions + invoices + plans)
-- - supabase/functions/subscription-manager (reads plans; upserts company_subscriptions; inserts billing_events)
--
-- NOTE: This is a minimal schema intended for demo + future expansion.
-- =====================================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE public.subscription_status_enum AS ENUM (
      'trialing',
      'active',
      'past_due',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
    CREATE TYPE public.invoice_status_enum AS ENUM (
      'draft',
      'open',
      'paid',
      'void',
      'uncollectible'
    );
  END IF;
END $$;

-- Plans are global; code-friendly IDs match the current UI values ("basic", "real_estate").
CREATE TABLE IF NOT EXISTS public.plans (
  id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  trial_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status public.subscription_status_enum NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  payment_method_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT company_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT company_subscriptions_company_unique UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON public.company_subscriptions(status);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  CONSTRAINT billing_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_company_id ON public.billing_events(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON public.billing_events(created_at);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount_due numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.invoice_status_enum NOT NULL DEFAULT 'open',
  invoice_pdf_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- Seed the two demo plans used by app/subscription.html
INSERT INTO public.plans (id, name, price, currency, trial_days, is_active)
VALUES
  ('basic', 'Basic', 9.99, 'USD', 30, true),
  ('real_estate', 'Real Estate', 24.99, 'USD', 14, true)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      trial_days = EXCLUDED.trial_days,
      is_active = EXCLUDED.is_active;

COMMIT;

