-- Bank (ACH) payments that are still clearing: billing_arrears.status = 'processing'
CREATE OR REPLACE FUNCTION public.sync_member_past_due_on_arrears_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'processing' AND COALESCE(OLD.status,'') <> 'processing' THEN
    UPDATE public.members SET payment_past_due = false WHERE id = NEW.member_id;
  ELSIF OLD.status = 'processing' AND NEW.status IN ('unpaid','partial') THEN
    UPDATE public.members SET payment_past_due = true WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_arrears_processing_past_due ON public.billing_arrears;
CREATE TRIGGER trg_arrears_processing_past_due
AFTER UPDATE OF status ON public.billing_arrears
FOR EACH ROW EXECUTE FUNCTION public.sync_member_past_due_on_arrears_processing();

CREATE OR REPLACE FUNCTION public.evaluate_member_check_in_eligibility(p_member_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_unresolved_membership_arrears boolean := false;
  v_bank_payment_clearing boolean := false;
  v_access_granted boolean := true;
  v_denial_reason text := NULL;
BEGIN
  SELECT id, email, status, subscription_status, billing_type,
         stripe_subscription_id, annual_fee_subscription_id, payment_past_due,
         records_cancelled_at
  INTO v_member FROM public.members WHERE id = p_member_id;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('access_granted', false, 'denial_reason', 'member_not_found');
  END IF;

  IF v_member.email IS NOT NULL AND public.is_email_blocked(v_member.email) THEN
    RETURN jsonb_build_object('access_granted', false, 'denial_reason', 'access_revoked');
  END IF;

  IF v_member.records_cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'access_granted', false, 'denial_reason', 'membership_cancelled',
      'member_status', v_member.status, 'subscription_status', v_member.subscription_status,
      'payment_past_due', COALESCE(v_member.payment_past_due, false),
      'has_unresolved_membership_arrears', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.billing_arrears
    WHERE member_id = v_member.id AND status = 'processing') INTO v_bank_payment_clearing;

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
  ELSIF v_member.status = 'past_due' AND NOT v_bank_payment_clearing THEN
    v_access_granted := false; v_denial_reason := 'payment_overdue';
  END IF;

  IF v_access_granted AND NOT v_bank_payment_clearing AND COALESCE(v_member.payment_past_due, false) = true THEN
    v_access_granted := false; v_denial_reason := 'payment_past_due';
  END IF;

  IF v_access_granted AND NOT v_bank_payment_clearing AND COALESCE(v_member.billing_type,'') <> 'cash'
     AND COALESCE(v_member.subscription_status,'') IN ('past_due','unpaid','canceled','incomplete_expired') THEN
    v_access_granted := false; v_denial_reason := 'subscription_' || v_member.subscription_status;
  END IF;

  IF v_access_granted THEN
    SELECT EXISTS (SELECT 1 FROM public.billing_arrears
      WHERE member_id = v_member.id AND status IN ('unpaid','partial')
        AND amount_due_cents > amount_paid_cents) INTO v_unresolved_membership_arrears;
    IF v_unresolved_membership_arrears THEN
      v_access_granted := false; v_denial_reason := 'unresolved_arrears';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'access_granted', v_access_granted, 'denial_reason', v_denial_reason,
    'member_status', v_member.status, 'subscription_status', v_member.subscription_status,
    'payment_past_due', COALESCE(v_member.payment_past_due, false),
    'has_unresolved_membership_arrears', v_unresolved_membership_arrears,
    'bank_payment_clearing', v_bank_payment_clearing);
END;
$function$;

-- Deana Boussi: Oct. 4 dues paid by bank transfer on Oct. 8, still clearing
UPDATE public.billing_arrears
SET status = 'processing', stripe_payment_intent_id = 'pi_3UMeXBLyZrsSqLhs0uOlKLDd', updated_at = now()
WHERE stripe_invoice_id = 'in_1UMeXALyZrsSqLhsy11vmiES' AND status = 'unpaid';