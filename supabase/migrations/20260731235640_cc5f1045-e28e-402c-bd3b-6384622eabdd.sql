CREATE OR REPLACE FUNCTION public.settle_membership_dues_payment(
  p_member_id uuid,
  p_amount_cents integer,
  p_note text DEFAULT NULL,
  p_actor_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer := GREATEST(COALESCE(p_amount_cents, 0), 0);
  v_row record;
  v_apply integer;
  v_settled integer := 0;
  v_outstanding integer := 0;
  v_status text;
BEGIN
  IF NOT (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role])
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR v_row IN
    SELECT id, amount_due_cents, amount_paid_cents
    FROM billing_arrears
    WHERE member_id = p_member_id
      AND status IN ('unpaid','partial')
      AND amount_due_cents > COALESCE(amount_paid_cents, 0)
    ORDER BY period_start ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, v_row.amount_due_cents - COALESCE(v_row.amount_paid_cents, 0));

    UPDATE billing_arrears
    SET amount_paid_cents = COALESCE(amount_paid_cents, 0) + v_apply,
        status = CASE
          WHEN COALESCE(amount_paid_cents, 0) + v_apply >= amount_due_cents THEN 'resolved'
          ELSE 'partial'
        END,
        resolution_reason = CASE
          WHEN COALESCE(amount_paid_cents, 0) + v_apply >= amount_due_cents
            THEN COALESCE(NULLIF(p_note, ''), 'Paid manually in club')
          ELSE resolution_reason
        END,
        resolved_at = CASE
          WHEN COALESCE(amount_paid_cents, 0) + v_apply >= amount_due_cents THEN now()
          ELSE resolved_at
        END,
        resolved_by_email = CASE
          WHEN COALESCE(amount_paid_cents, 0) + v_apply >= amount_due_cents THEN p_actor_email
          ELSE resolved_by_email
        END,
        paid_at = CASE
          WHEN COALESCE(amount_paid_cents, 0) + v_apply >= amount_due_cents THEN now()
          ELSE paid_at
        END,
        updated_at = now()
    WHERE id = v_row.id;

    v_remaining := v_remaining - v_apply;
    v_settled := v_settled + 1;
  END LOOP;

  SELECT COALESCE(SUM(amount_due_cents - COALESCE(amount_paid_cents, 0)), 0)
  INTO v_outstanding
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid','partial')
    AND amount_due_cents > COALESCE(amount_paid_cents, 0);

  SELECT status INTO v_status FROM members WHERE id = p_member_id;

  IF v_outstanding <= 0 THEN
    UPDATE members
    SET payment_past_due = false,
        payment_past_due_since = NULL,
        status = CASE WHEN status = 'past_due' THEN 'active' ELSE status END,
        subscription_status = CASE WHEN subscription_status = 'past_due' THEN 'active' ELSE subscription_status END,
        updated_at = now()
    WHERE id = p_member_id;
  END IF;

  RETURN jsonb_build_object(
    'invoices_settled', v_settled,
    'outstanding_cents', v_outstanding,
    'unapplied_cents', v_remaining,
    'previous_status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_membership_dues_payment(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_membership_dues_payment(uuid, integer, text, text) TO authenticated, service_role;