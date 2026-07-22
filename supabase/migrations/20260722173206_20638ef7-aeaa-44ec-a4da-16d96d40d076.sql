CREATE OR REPLACE FUNCTION public.enforce_no_freeze_when_past_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outstanding bigint := 0;
  v_sub_status text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(GREATEST(ba.amount_due_cents - COALESCE(ba.amount_paid_cents, 0), 0)), 0)::bigint
    INTO v_outstanding
  FROM public.billing_arrears ba
  WHERE ba.member_id = NEW.member_id
    AND GREATEST(ba.amount_due_cents - COALESCE(ba.amount_paid_cents, 0), 0) > 0
    AND COALESCE(ba.status, 'open') NOT IN ('paid', 'waived', 'cancelled', 'written_off', 'resolved');

  IF v_outstanding > 0 THEN
    RAISE EXCEPTION 'PAST_DUE_BLOCK: You have an outstanding balance of $%. Please settle it before requesting a freeze.',
      to_char((v_outstanding::numeric / 100), 'FM999,999,990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT subscription_status INTO v_sub_status
  FROM public.members WHERE id = NEW.member_id;

  IF v_sub_status = 'past_due' THEN
    RAISE EXCEPTION 'PAST_DUE_BLOCK: Your subscription is past due. Please settle your balance before requesting a freeze.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_freeze_block_status()
RETURNS TABLE(blocked boolean, outstanding_cents bigint, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_member RECORD;
  v_outstanding bigint := 0;
  v_sub_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::text;
    RETURN;
  END IF;

  SELECT id, subscription_status
    INTO v_member
  FROM public.members
  WHERE user_id = v_uid
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::text;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(GREATEST(ba.amount_due_cents - COALESCE(ba.amount_paid_cents, 0), 0)), 0)::bigint
    INTO v_outstanding
  FROM public.billing_arrears ba
  WHERE ba.member_id = v_member.id
    AND GREATEST(ba.amount_due_cents - COALESCE(ba.amount_paid_cents, 0), 0) > 0
    AND COALESCE(ba.status, 'open') NOT IN ('paid', 'waived', 'cancelled', 'written_off', 'resolved');

  v_sub_status := COALESCE(v_member.subscription_status, '');

  IF v_outstanding > 0 THEN
    RETURN QUERY SELECT true, v_outstanding, 'outstanding_balance'::text;
    RETURN;
  END IF;

  IF v_sub_status = 'past_due' THEN
    RETURN QUERY SELECT true, 0::bigint, 'past_due_subscription'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0::bigint, NULL::text;
END;
$function$;