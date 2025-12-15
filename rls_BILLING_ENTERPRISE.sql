-- =====================================================================================
-- Billing / Subscriptions RLS (Enterprise CLM)
-- Updated: 2025-12-13
--
-- Run AFTER:
-- - schema_BILLING_ENTERPRISE.sql
-- - rls_UPDATED_ENTERPRISE.sql
--
-- End users: read-only access to billing objects for their company.
-- Writes are reserved for trusted server-side code (service role / Edge Functions).
-- =====================================================================================

BEGIN;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Plans: readable by any authenticated user.
DROP POLICY IF EXISTS "plans_select_authenticated" ON public.plans;
CREATE POLICY "plans_select_authenticated"
ON public.plans
FOR SELECT
TO authenticated
USING (true);

-- Subscriptions: members can read; no end-user writes.
DROP POLICY IF EXISTS "company_subscriptions_select_member" ON public.company_subscriptions;
CREATE POLICY "company_subscriptions_select_member"
ON public.company_subscriptions
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

REVOKE INSERT, UPDATE, DELETE ON public.company_subscriptions FROM authenticated;

-- Invoices: members can read; no end-user writes.
DROP POLICY IF EXISTS "invoices_select_member" ON public.invoices;
CREATE POLICY "invoices_select_member"
ON public.invoices
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated;

-- Billing events: admins can read; no end-user writes.
DROP POLICY IF EXISTS "billing_events_select_admin" ON public.billing_events;
CREATE POLICY "billing_events_select_admin"
ON public.billing_events
FOR SELECT
TO authenticated
USING (public.is_company_admin(company_id));

REVOKE INSERT, UPDATE, DELETE ON public.billing_events FROM authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

