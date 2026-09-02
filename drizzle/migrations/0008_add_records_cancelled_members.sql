ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS records_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS records_cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS records_cancelled_reason text,
  ADD COLUMN IF NOT EXISTS records_collection_status text;

CREATE INDEX IF NOT EXISTS idx_members_records_cancelled_at ON public.members (records_cancelled_at) WHERE records_cancelled_at IS NOT NULL;

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
         stripe_subscription_id, annual_fee_subscription_id, payment_past_due,
         records_cancelled_at
  INTO v_member
  FROM public.members
  WHERE id = p_member_id;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'access_granted', false,
      'denial_reason', 'member_not_found'
    );
  END IF;

  IF v_member.email IS NOT NULL AND public.is_email_blocked(v_member.email) THEN
    RETURN jsonb_build_object(
      'access_granted', false,
      'denial_reason', 'access_revoked'
    );
  END IF;

  -- Records-only cancellation (internal list): hard block, un-overridable
  IF v_member.records_cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'access_granted', false,
      'denial_reason', 'membership_cancelled',
      'member_status', v_member.status,
      'subscription_status', v_member.subscription_status,
      'payment_past_due', COALESCE(v_member.payment_past_due, false),
      'has_unresolved_membership_arrears', false
    );
  END IF;

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

  IF v_access_granted AND COALESCE(v_member.payment_past_due, false) = true THEN
    v_access_granted := false;
    v_denial_reason := 'payment_past_due';
  END IF;

  IF v_access_granted AND COALESCE(v_member.billing_type,'') <> 'cash'
     AND COALESCE(v_member.subscription_status,'') IN ('past_due','unpaid','canceled','incomplete_expired') THEN
    v_access_granted := false;
    v_denial_reason := 'subscription_' || v_member.subscription_status;
  END IF;

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