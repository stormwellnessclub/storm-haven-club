-- Billing reconciliation (approved by the owner, Oct 2026)
--
-- Stripe is the source of truth for whether an invoice is paid. The app learns
-- about payments from Stripe webhooks, and a webhook that never arrived or failed
-- leaves the app out of step: a member shown as owing a month Stripe already
-- collected, or a payment missing from payment history.
--
-- The `reconcile-billing` edge function compares the app with Stripe nightly
-- (and on demand) and records every run and every finding here:
--   * corrections it can make safely — a month Stripe says is paid is marked
--     paid, reminders stop, the past-due flag clears when nothing else is owed,
--     a payment the app never heard about is added to payment history;
--   * anything that would restrict a member (Stripe says unpaid but the app has
--     no record) is never applied automatically — it is listed for staff review.
-- It never charges, refunds or emails anyone.

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  triggered_by uuid,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS billing_reconciliation_runs_started_idx
  ON public.billing_reconciliation_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.billing_reconciliation_runs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  stripe_invoice_id text,
  kind text NOT NULL,
  action text NOT NULL CHECK (action IN ('corrected', 'needs_review', 'info')),
  message text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
);

CREATE INDEX IF NOT EXISTS billing_reconciliation_items_run_idx
  ON public.billing_reconciliation_items (run_id);
CREATE INDEX IF NOT EXISTS billing_reconciliation_items_open_review_idx
  ON public.billing_reconciliation_items (created_at DESC)
  WHERE action = 'needs_review' AND reviewed_at IS NULL;
-- One open review item per member + invoice + kind, so a nightly run does not
-- re-list the same problem every day.
CREATE UNIQUE INDEX IF NOT EXISTS billing_reconciliation_items_open_unique
  ON public.billing_reconciliation_items (kind, coalesce(member_id::text, ''), coalesce(stripe_invoice_id, ''))
  WHERE action = 'needs_review' AND reviewed_at IS NULL;

COMMENT ON TABLE public.billing_reconciliation_runs IS
  'Each comparison of app billing records against Stripe, by reconcile-billing.';
COMMENT ON TABLE public.billing_reconciliation_items IS
  'Corrections reconcile-billing made and findings it left for staff review.';

ALTER TABLE public.billing_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_reconciliation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance staff read reconciliation runs" ON public.billing_reconciliation_runs;
CREATE POLICY "Finance staff read reconciliation runs"
  ON public.billing_reconciliation_runs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

DROP POLICY IF EXISTS "Finance staff read reconciliation items" ON public.billing_reconciliation_items;
CREATE POLICY "Finance staff read reconciliation items"
  ON public.billing_reconciliation_items FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Staff mark review items as handled through this function only, so they cannot
-- alter what the reconciliation recorded.
CREATE OR REPLACE FUNCTION public.review_billing_reconciliation_item(p_item_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.billing_reconciliation_items
  SET reviewed_at = now(), reviewed_by = auth.uid(), review_note = NULLIF(trim(p_note), '')
  WHERE id = p_item_id AND action = 'needs_review' AND reviewed_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_billing_reconciliation_item(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_billing_reconciliation_item(uuid, text) TO authenticated;

-- Automatic membership status changes from billing (approved by the owner).
--
-- Billing may only move a member between 'active' and 'past_due':
--   payment failed    active   -> past_due
--   payment received  past_due -> active
-- Frozen, cancelled, expired and pending-activation members are never changed by
-- billing: freezes, cancellations and activations stay staff decisions. The row is
-- locked while checking, so two webhook deliveries cannot race each other.
-- Every change is written to subscription_status_history.
-- Returns 'changed', 'unchanged' or 'skipped:<current status>'.
CREATE OR REPLACE FUNCTION public.apply_billing_status_change(
  p_member_id uuid,
  p_target text,
  p_reason text,
  p_stripe_event_id text DEFAULT NULL,
  p_changed_by text DEFAULT 'stripe'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_target NOT IN ('active', 'past_due') THEN
    RAISE EXCEPTION 'apply_billing_status_change: unsupported target status %', p_target;
  END IF;

  SELECT status INTO v_status FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'skipped:not_found';
  END IF;
  IF v_status = p_target THEN
    RETURN 'unchanged';
  END IF;
  IF NOT ((v_status = 'active' AND p_target = 'past_due') OR (v_status = 'past_due' AND p_target = 'active')) THEN
    RETURN 'skipped:' || coalesce(v_status, 'null');
  END IF;

  INSERT INTO public.subscription_status_history (member_id, old_status, new_status, change_reason, stripe_event_id, changed_by)
  VALUES (p_member_id, v_status, p_target, p_reason, p_stripe_event_id, p_changed_by);

  UPDATE public.members SET status = p_target, updated_at = now() WHERE id = p_member_id;
  RETURN 'changed';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_billing_status_change(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_billing_status_change(uuid, text, text, text, text) TO service_role;

-- Nightly at 08:15 UTC (3:15–4:15 AM in Detroit), after Stripe's overnight retries.
-- The service-role key is read from the vault when the job runs; nothing secret
-- is stored here.
DO $$
BEGIN
  PERFORM cron.unschedule('reconcile-billing-nightly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-billing-nightly');

  PERFORM cron.schedule(
    'reconcile-billing-nightly',
    '15 8 * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/reconcile-billing',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            ''
          )
        ),
        body := '{"trigger": "scheduled"}'::jsonb,
        timeout_milliseconds := 150000
      );
    $cmd$
  );
END $$;
