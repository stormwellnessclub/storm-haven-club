-- Revenue ledger (payment systems audit, phase 2)
--
-- One append-only record of money in and out that every revenue and sales-tax
-- report reads. Written only by the `sync-revenue-ledger` edge function:
--   * source 'stripe'  — every Stripe balance transaction (charges, refunds,
--     disputes), so card revenue always matches deposits;
--   * source 'offline' — cash, check, Clover and other sales recorded in the app.
-- A sale paying for several areas (a café item and a kids-care pass) is split
-- into one line per area. Refunds and disputes are negative lines dated when they
-- happen, so closed months never change.
--
-- gross = net + tax + fee + tip, per line, in cents:
--   tax  — Michigan sales tax collected (owed to the state)
--   fee  — card processing fee the customer paid
--   tip  — staff tips collected through a charge

CREATE TABLE IF NOT EXISTS public.revenue_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('stripe', 'offline')),
  source_ref text NOT NULL,
  line_no integer NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('sale', 'refund', 'dispute', 'dispute_reversal')),
  occurred_at timestamptz NOT NULL,
  business_date date NOT NULL,
  area text NOT NULL,
  label text,
  description text,
  gross_cents bigint NOT NULL,
  tax_cents bigint NOT NULL DEFAULT 0,
  fee_cents bigint NOT NULL DEFAULT 0,
  tip_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint GENERATED ALWAYS AS (gross_cents - tax_cents - fee_cents - tip_cents) STORED,
  stripe_fee_cents bigint NOT NULL DEFAULT 0,
  tender text NOT NULL,
  taxable boolean NOT NULL DEFAULT false,
  estimated boolean NOT NULL DEFAULT false,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_balance_txn_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref, line_no)
);

CREATE INDEX IF NOT EXISTS revenue_ledger_business_date_idx ON public.revenue_ledger (business_date);
CREATE INDEX IF NOT EXISTS revenue_ledger_area_date_idx ON public.revenue_ledger (area, business_date);
CREATE INDEX IF NOT EXISTS revenue_ledger_charge_idx ON public.revenue_ledger (stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS revenue_ledger_offline_occurred_idx ON public.revenue_ledger (occurred_at) WHERE source = 'offline';

COMMENT ON TABLE public.revenue_ledger IS
  'Single source of truth for revenue and sales tax. Written only by the sync-revenue-ledger edge function.';

CREATE TABLE IF NOT EXISTS public.revenue_ledger_sync_state (
  key text PRIMARY KEY,
  cursor_unix bigint,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_result jsonb
);

-- Finance staff can read; only the service role (the sync function) writes.
ALTER TABLE public.revenue_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_ledger_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance staff read revenue ledger" ON public.revenue_ledger;
CREATE POLICY "Finance staff read revenue ledger"
  ON public.revenue_ledger FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

DROP POLICY IF EXISTS "Finance staff read revenue sync state" ON public.revenue_ledger_sync_state;
CREATE POLICY "Finance staff read revenue sync state"
  ON public.revenue_ledger_sync_state FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Aggregated revenue for a business-date range (inclusive). Reports group this
-- further by day, month, area or tender; aggregation happens in the database so
-- there is no row limit.
CREATE OR REPLACE FUNCTION public.get_revenue_summary(p_start date, p_end date)
RETURNS TABLE (
  business_date date,
  area text,
  tender text,
  kind text,
  taxable boolean,
  is_member boolean,
  entries bigint,
  gross_cents bigint,
  tax_cents bigint,
  fee_cents bigint,
  tip_cents bigint,
  net_cents bigint,
  estimated_entries bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.business_date,
    l.area,
    l.tender,
    l.kind,
    l.taxable,
    (l.member_id IS NOT NULL) AS is_member,
    count(*)::bigint,
    sum(l.gross_cents)::bigint,
    sum(l.tax_cents)::bigint,
    sum(l.fee_cents)::bigint,
    sum(l.tip_cents)::bigint,
    sum(l.net_cents)::bigint,
    count(*) FILTER (WHERE l.estimated)::bigint
  FROM public.revenue_ledger l
  WHERE l.business_date BETWEEN p_start AND p_end
  GROUP BY l.business_date, l.area, l.tender, l.kind, l.taxable, (l.member_id IS NOT NULL)
  ORDER BY l.business_date;
$$;

REVOKE EXECUTE ON FUNCTION public.get_revenue_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_revenue_summary(date, date) TO authenticated;
