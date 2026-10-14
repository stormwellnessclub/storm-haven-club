-- Link failed payment attempts to the payment that later succeeded (Oct 2026).
--
-- Stripe does not deliver webhook events in order. When "payment failed" for an
-- invoice was processed AFTER "payment succeeded" for the same invoice, the app
-- recorded the failure last: the attempt stayed 'failed', the month went back to
-- unpaid, reminders restarted and the member was flagged past due, although
-- Stripe shows the invoice paid.
--
-- This migration only adds rules for FUTURE writes; applying it changes no
-- existing record:
--   1. a failure recorded for an invoice that already has a recorded success is
--      resolved on arrival (linked to that success);
--   2. a paid, resolved or void month cannot be set back to unpaid by a failure;
--      only a deliberate reopen (which stamps reopened_at, e.g. a dispute) can;
--   3. a reminder sequence for a paid invoice stays recovered;
--   4. when a reminder sequence ends, the member's past-due flag and status are
--      re-evaluated (cleared only when nothing else is owed).
-- Existing records in that state are listed by billing_link_repair_preview() and
-- repaired only when an admin runs apply_billing_link_repairs() (Billing Arrears
-- page), which logs every change in the reconciliation audit trail.

-- Helpers ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invoice_has_recorded_payment(p_member_id uuid, p_stripe_invoice_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_stripe_invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payment_attempts
    WHERE stripe_invoice_id = p_stripe_invoice_id
      AND status = 'succeeded'
      AND (p_member_id IS NULL OR member_id = p_member_id)
  );
$$;

-- Clear the past-due flag and past_due status when nothing is owed (no active
-- reminder sequence, no unpaid month). Mirrors canClearPastDue in the edge functions.
CREATE OR REPLACE FUNCTION public.reevaluate_member_past_due(p_member_id uuid, p_reason text DEFAULT 'nothing_owed')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_member_id IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_dunning_state WHERE member_id = p_member_id AND status = 'active')
     OR EXISTS (SELECT 1 FROM public.billing_arrears WHERE member_id = p_member_id AND status = 'unpaid') THEN
    RETURN false;
  END IF;
  UPDATE public.members
  SET payment_past_due = false, payment_past_due_since = NULL, updated_at = now()
  WHERE id = p_member_id AND payment_past_due = true;
  PERFORM public.apply_billing_status_change(p_member_id, 'active', p_reason, NULL, 'payment_link_rule');
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoice_has_recorded_payment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reevaluate_member_past_due(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_has_recorded_payment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reevaluate_member_past_due(uuid, text) TO service_role;

-- 1. A failure arriving after the success is resolved on arrival ───────────────

CREATE OR REPLACE FUNCTION public.supersede_late_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_success_id uuid;
BEGIN
  IF NEW.status IN ('failed', 'requires_action') AND NEW.stripe_invoice_id IS NOT NULL AND NEW.superseded_at IS NULL THEN
    SELECT id INTO v_success_id
    FROM public.payment_attempts
    WHERE stripe_invoice_id = NEW.stripe_invoice_id
      AND status = 'succeeded'
      AND id IS DISTINCT FROM NEW.id
      AND (NEW.member_id IS NULL OR member_id = NEW.member_id)
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_success_id IS NOT NULL THEN
      NEW.superseded_by_attempt_id := v_success_id;
      NEW.superseded_at := now();
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
      NEW.resolution_note := COALESCE(NEW.resolution_note, 'paid_before_failure_was_recorded');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_attempts_supersede_late_failure ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_supersede_late_failure
BEFORE INSERT OR UPDATE OF status ON public.payment_attempts
FOR EACH ROW
EXECUTE FUNCTION public.supersede_late_failure();

-- 2. A settled month is never reopened by a failure ─────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_settled_arrears()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('paid', 'resolved', 'void')
       AND NEW.status IN ('unpaid', 'partial', 'processing')
       AND NEW.reopened_at IS NOT DISTINCT FROM OLD.reopened_at THEN
      NEW.status := OLD.status;
      NEW.amount_paid_cents := OLD.amount_paid_cents;
      NEW.paid_at := OLD.paid_at;
      NEW.resolved_at := OLD.resolved_at;
      NEW.resolution_reason := OLD.resolution_reason;
      NEW.next_retry_at := NULL;
      NEW.failure_code := OLD.failure_code;
      NEW.failure_message := OLD.failure_message;
      NEW.decline_code := OLD.decline_code;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('unpaid', 'partial')
       AND public.invoice_has_recorded_payment(NEW.member_id, NEW.stripe_invoice_id) THEN
      NEW.status := 'paid';
      NEW.amount_paid_cents := GREATEST(COALESCE(NEW.amount_paid_cents, 0), COALESCE(NEW.amount_due_cents, 0));
      NEW.paid_at := COALESCE(NEW.paid_at, now());
      NEW.resolution_reason := COALESCE(NEW.resolution_reason, 'Paid before the failure was recorded');
      NEW.next_retry_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_arrears_guard_settled ON public.billing_arrears;
CREATE TRIGGER trg_billing_arrears_guard_settled
BEFORE INSERT OR UPDATE ON public.billing_arrears
FOR EACH ROW
EXECUTE FUNCTION public.guard_settled_arrears();

-- 3. A reminder sequence for a paid invoice stays recovered ─────────────────────

CREATE OR REPLACE FUNCTION public.guard_recovered_dunning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF public.invoice_has_recorded_payment(NEW.member_id, NEW.stripe_invoice_id)
     OR EXISTS (
       SELECT 1 FROM public.billing_arrears
       WHERE stripe_invoice_id = NEW.stripe_invoice_id
         AND member_id = NEW.member_id
         AND status IN ('paid', 'resolved', 'void')
         AND reopened_at IS NULL
     ) THEN
    NEW.status := 'recovered';
    NEW.recovered_at := COALESCE(NEW.recovered_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_dunning_guard_recovered ON public.payment_dunning_state;
CREATE TRIGGER trg_payment_dunning_guard_recovered
BEFORE INSERT OR UPDATE ON public.payment_dunning_state
FOR EACH ROW
EXECUTE FUNCTION public.guard_recovered_dunning();

-- 4. Re-evaluate the member when a reminder sequence ends ───────────────────────

CREATE OR REPLACE FUNCTION public.reevaluate_past_due_after_dunning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' AND NEW.member_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.reevaluate_member_past_due(NEW.member_id, 'payment_recorded');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_dunning_reevaluate_past_due ON public.payment_dunning_state;
CREATE TRIGGER trg_payment_dunning_reevaluate_past_due
AFTER INSERT OR UPDATE ON public.payment_dunning_state
FOR EACH ROW
EXECUTE FUNCTION public.reevaluate_past_due_after_dunning();

-- Existing records: preview, then admin-approved repair ─────────────────────────

-- What apply_billing_link_repairs() would change. Read-only.
CREATE OR REPLACE FUNCTION public.billing_link_repair_preview()
RETURNS TABLE (repair text, member_id uuid, member_name text, stripe_invoice_id text, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'failed_attempt_has_later_payment', f.member_id,
         trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')),
         f.stripe_invoice_id,
         format('Failed %s attempt of %s on %s is still open; a payment for the same bill is recorded', f.status, f.amount, f.created_at::date)
  FROM public.payment_attempts f
  LEFT JOIN public.members m ON m.id = f.member_id
  WHERE f.status IN ('failed', 'requires_action')
    AND (f.superseded_at IS NULL OR f.resolved_at IS NULL)
    AND public.invoice_has_recorded_payment(f.member_id, f.stripe_invoice_id)
  UNION ALL
  SELECT 'month_owed_but_paid', b.member_id,
         trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')),
         b.stripe_invoice_id,
         format('Month starting %s shown as %s (%s cents) although a payment for that bill is recorded', b.period_start, b.status, b.amount_due_cents - coalesce(b.amount_paid_cents, 0))
  FROM public.billing_arrears b
  LEFT JOIN public.members m ON m.id = b.member_id
  WHERE b.status IN ('unpaid', 'partial')
    AND b.reopened_at IS NULL
    AND public.invoice_has_recorded_payment(b.member_id, b.stripe_invoice_id)
  UNION ALL
  SELECT 'reminders_running_for_paid_bill', d.member_id,
         trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')),
         d.stripe_invoice_id,
         format('Payment reminders still active since %s', d.first_failed_at::date)
  FROM public.payment_dunning_state d
  LEFT JOIN public.members m ON m.id = d.member_id
  WHERE d.status = 'active'
    AND (public.invoice_has_recorded_payment(d.member_id, d.stripe_invoice_id)
         OR EXISTS (SELECT 1 FROM public.billing_arrears b
                    WHERE b.stripe_invoice_id = d.stripe_invoice_id AND b.member_id = d.member_id
                      AND b.status IN ('paid', 'resolved', 'void') AND b.reopened_at IS NULL));
$$;

-- Apply the repairs listed by the preview, log them, then clear past-due flags
-- for members who no longer owe anything. Admins only.
CREATE OR REPLACE FUNCTION public.apply_billing_link_repairs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run uuid;
  v_attempts int := 0;
  v_arrears int := 0;
  v_dunning int := 0;
  v_members int := 0;
  r record;
  v_affected uuid[] := '{}';
  v_flagged uuid[];
BEGIN
  IF NOT (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.billing_reconciliation_runs (trigger, triggered_by, status, summary)
  VALUES ('manual', auth.uid(), 'running', jsonb_build_object('action', 'link_failures_to_later_payments'))
  RETURNING id INTO v_run;

  -- Members flagged before the repair (the reminder trigger may clear them during it).
  SELECT coalesce(array_agg(id), '{}') INTO v_flagged
  FROM public.members WHERE payment_past_due OR status = 'past_due';

  -- a. Failed attempts on bills that have a recorded payment
  WITH s AS (
    SELECT DISTINCT ON (stripe_invoice_id, member_id) id, stripe_invoice_id, member_id
    FROM public.payment_attempts
    WHERE status = 'succeeded' AND stripe_invoice_id IS NOT NULL
    ORDER BY stripe_invoice_id, member_id, created_at DESC
  ), upd AS (
    UPDATE public.payment_attempts f
    SET superseded_by_attempt_id = s.id,
        superseded_at = COALESCE(f.superseded_at, now()),
        resolved_at = COALESCE(f.resolved_at, now()),
        resolution_note = COALESCE(f.resolution_note, 'paid_before_failure_was_recorded')
    FROM s
    WHERE f.stripe_invoice_id = s.stripe_invoice_id
      AND f.member_id IS NOT DISTINCT FROM s.member_id
      AND f.status IN ('failed', 'requires_action')
      AND (f.superseded_at IS NULL OR f.resolved_at IS NULL)
    RETURNING f.member_id
  )
  SELECT count(*), coalesce(array_agg(DISTINCT member_id) FILTER (WHERE member_id IS NOT NULL), '{}')
  INTO v_attempts, v_affected FROM upd;

  -- b. Months shown as owed although a payment for that bill is recorded
  FOR r IN
    SELECT b.id, b.member_id, b.stripe_invoice_id, b.status, b.amount_paid_cents, b.period_start,
           (SELECT max(coalesce(p.succeeded_at, p.created_at)) FROM public.payment_attempts p
             WHERE p.stripe_invoice_id = b.stripe_invoice_id AND p.member_id = b.member_id AND p.status = 'succeeded') AS paid_at
    FROM public.billing_arrears b
    WHERE b.status IN ('unpaid', 'partial')
      AND b.reopened_at IS NULL
      AND public.invoice_has_recorded_payment(b.member_id, b.stripe_invoice_id)
  LOOP
    UPDATE public.billing_arrears
    SET status = 'paid',
        amount_paid_cents = GREATEST(COALESCE(amount_paid_cents, 0), amount_due_cents),
        paid_at = COALESCE(paid_at, r.paid_at, now()),
        resolved_at = now(),
        resolution_reason = 'Linked to the recorded payment for this bill (the failure had been recorded after the payment)',
        next_retry_at = NULL,
        updated_at = now()
    WHERE id = r.id;
    v_arrears := v_arrears + 1;
    v_affected := v_affected || r.member_id;
    INSERT INTO public.billing_reconciliation_items (run_id, member_id, stripe_invoice_id, kind, action, message, before_state, after_state)
    VALUES (v_run, r.member_id, r.stripe_invoice_id, 'linked_late_failure', 'corrected',
            format('The month starting %s was shown as owed, but a payment for the same bill is recorded (the failure had been recorded after it). Marked paid.', r.period_start),
            jsonb_build_object('status', r.status, 'amount_paid_cents', r.amount_paid_cents),
            jsonb_build_object('status', 'paid'));
  END LOOP;

  -- c. Reminder sequences running for paid bills (the guard trigger marks them recovered)
  WITH upd AS (
    UPDATE public.payment_dunning_state d
    SET status = 'recovered', recovered_at = COALESCE(d.recovered_at, now()), updated_at = now()
    WHERE d.status = 'active'
      AND (public.invoice_has_recorded_payment(d.member_id, d.stripe_invoice_id)
           OR EXISTS (SELECT 1 FROM public.billing_arrears b
                      WHERE b.stripe_invoice_id = d.stripe_invoice_id AND b.member_id = d.member_id
                        AND b.status IN ('paid', 'resolved', 'void') AND b.reopened_at IS NULL))
    RETURNING d.member_id
  )
  SELECT count(*), v_affected || coalesce(array_agg(member_id) FILTER (WHERE member_id IS NOT NULL), '{}')
  INTO v_dunning, v_affected FROM upd;

  -- d. Members touched above who no longer owe anything
  FOR r IN SELECT DISTINCT unnest(v_affected) AS id LOOP
    PERFORM public.reevaluate_member_past_due(r.id, 'nothing_owed_after_linking_payments');
    IF r.id = ANY (v_flagged)
       AND NOT EXISTS (SELECT 1 FROM public.members WHERE id = r.id AND (payment_past_due OR status = 'past_due')) THEN
      v_members := v_members + 1;
      INSERT INTO public.billing_reconciliation_items (run_id, member_id, kind, action, message, after_state)
      VALUES (v_run, r.id, 'cleared_past_due_flag', 'corrected',
              'Nothing is owed once failures are linked to the payments that followed them. Past-due flag cleared and status set back to active.',
              jsonb_build_object('payment_past_due', false));
    END IF;
  END LOOP;

  UPDATE public.billing_reconciliation_runs
  SET status = 'succeeded', finished_at = now(),
      summary = summary || jsonb_build_object(
        'failed_attempts_linked', v_attempts,
        'months_marked_paid', v_arrears,
        'reminder_sequences_closed', v_dunning,
        'members_cleared', v_members,
        'corrected', v_attempts + v_arrears + v_dunning + v_members,
        'needs_review', 0,
        'complete', true)
  WHERE id = v_run;

  RETURN jsonb_build_object('failed_attempts_linked', v_attempts, 'months_marked_paid', v_arrears,
                            'reminder_sequences_closed', v_dunning, 'members_cleared', v_members);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.billing_link_repair_preview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_billing_link_repairs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_billing_link_repairs() TO authenticated, service_role;

-- The preview is read by finance staff only.
CREATE OR REPLACE FUNCTION public.billing_link_repair_preview_for_staff()
RETURNS TABLE (repair text, member_id uuid, member_name text, stripe_invoice_id text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.billing_link_repair_preview();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.billing_link_repair_preview() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.billing_link_repair_preview_for_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_link_repair_preview_for_staff() TO authenticated;
