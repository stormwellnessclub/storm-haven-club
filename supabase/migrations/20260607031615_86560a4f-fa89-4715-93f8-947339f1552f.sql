-- 1) Add payment_past_due explicit check to eligibility RPC
CREATE OR REPLACE FUNCTION public.evaluate_member_check_in_eligibility(p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_unresolved_membership_arrears boolean := false;
  v_access_granted boolean := true;
  v_denial_reason text := NULL;
BEGIN
  SELECT id, email, status, subscription_status, billing_type,
         stripe_subscription_id, annual_fee_subscription_id, payment_past_due
  INTO v_member
  FROM public.members
  WHERE id = p_member_id;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'access_granted', false,
      'denial_reason', 'member_not_found'
    );
  END IF;

  -- Blocked
  IF v_member.email IS NOT NULL AND public.is_email_blocked(v_member.email) THEN
    RETURN jsonb_build_object(
      'access_granted', false,
      'denial_reason', 'access_revoked'
    );
  END IF;

  -- Lifecycle status
  IF v_member.status = 'cancelled' THEN
    v_access_granted := false; v_denial_reason := 'membership_cancelled';
  ELSIF v_member.status = 'expired' THEN
    v_access_granted := false; v_denial_reason := 'membership_expired';
  ELSIF v_member.status = 'suspended' THEN
    v_access_granted := false; v_denial_reason := 'membership_suspended';
  ELSIF v_member.status = 'frozen' THEN
    v_access_granted := false; v_denial_reason := 'membership_frozen';
  ELSIF v_member.status = 'pending_activation' THEN
    v_access_granted := false; v_denial_reason := 'pending_activation';
  ELSIF v_member.status = 'past_due' THEN
    v_access_granted := false; v_denial_reason := 'payment_overdue';
  END IF;

  -- Explicit payment_past_due flag (set by dunning system / Stripe webhook).
  -- Hard block, un-overridable (same level as frozen/unpaid).
  IF v_access_granted AND COALESCE(v_member.payment_past_due, false) = true THEN
    v_access_granted := false;
    v_denial_reason := 'payment_past_due';
  END IF;

  -- Subscription status (only for non-cash billing)
  IF v_access_granted AND COALESCE(v_member.billing_type,'') <> 'cash'
     AND COALESCE(v_member.subscription_status,'') IN ('past_due','unpaid','canceled','incomplete_expired') THEN
    v_access_granted := false;
    v_denial_reason := 'subscription_' || v_member.subscription_status;
  END IF;

  -- Unresolved MEMBERSHIP arrears
  IF v_access_granted THEN
    SELECT EXISTS (
      SELECT 1 FROM public.billing_arrears
      WHERE member_id = v_member.id
        AND status IN ('unpaid','partial')
        AND amount_due_cents > amount_paid_cents
    ) INTO v_unresolved_membership_arrears;

    IF v_unresolved_membership_arrears THEN
      v_access_granted := false;
      v_denial_reason := 'unresolved_arrears';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'access_granted', v_access_granted,
    'denial_reason', v_denial_reason,
    'member_status', v_member.status,
    'subscription_status', v_member.subscription_status,
    'payment_past_due', COALESCE(v_member.payment_past_due, false),
    'has_unresolved_membership_arrears', v_unresolved_membership_arrears
  );
END;
$function$;

-- 2) Kids Care booking guard: block past_due members at insert time
CREATE OR REPLACE FUNCTION public.block_kids_care_booking_if_past_due()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_past_due boolean;
  v_status text;
BEGIN
  -- Only validate new active bookings (allow cancellations / status updates)
  IF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.member_id = OLD.member_id
     AND NEW.status NOT IN ('confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(payment_past_due, false), status
    INTO v_past_due, v_status
  FROM public.members
  WHERE id = NEW.member_id;

  IF v_past_due = true OR v_status = 'past_due' THEN
    RAISE EXCEPTION 'Kids Care booking unavailable — membership payment is past due. Please update your payment method to resume Kids Care.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_kids_care_past_due ON public.kids_care_bookings;
CREATE TRIGGER trg_block_kids_care_past_due
  BEFORE INSERT OR UPDATE ON public.kids_care_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.block_kids_care_booking_if_past_due();