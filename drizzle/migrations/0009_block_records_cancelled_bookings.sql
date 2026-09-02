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

  SELECT id, subscription_status, records_cancelled_at
    INTO v_member
  FROM public.members
  WHERE user_id = v_uid
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::text;
    RETURN;
  END IF;

  IF v_member.records_cancelled_at IS NOT NULL THEN
    RETURN QUERY SELECT true, 0::bigint, 'membership_cancelled'::text;
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