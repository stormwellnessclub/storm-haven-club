
-- ============================================================
-- 1. Add supersede tracking to payment_attempts
-- ============================================================
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS superseded_by_attempt_id uuid REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_superseded
  ON public.payment_attempts(superseded_at) WHERE superseded_at IS NULL;

-- ============================================================
-- 2. Trigger: when a successful payment_attempts row is inserted
--    or updated to succeeded, mark prior failed attempts for the
--    same member + same amount within 10 minutes as superseded.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_superseded_failed_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND NEW.member_id IS NOT NULL THEN
    UPDATE public.payment_attempts
    SET
      superseded_by_attempt_id = NEW.id,
      superseded_at = now(),
      resolved_at = COALESCE(resolved_at, now()),
      resolution_note = COALESCE(resolution_note, 'superseded_by_retry')
    WHERE member_id = NEW.member_id
      AND id <> NEW.id
      AND status IN ('failed', 'requires_action')
      AND superseded_at IS NULL
      AND amount = NEW.amount
      AND created_at >= NEW.created_at - interval '10 minutes'
      AND created_at <= NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_attempts_supersede ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_supersede
AFTER INSERT OR UPDATE OF status ON public.payment_attempts
FOR EACH ROW
EXECUTE FUNCTION public.mark_superseded_failed_attempts();

-- ============================================================
-- 3. One-time backfill: clear historical stale failures
-- ============================================================
WITH retries AS (
  SELECT
    f.id AS failed_id,
    s.id AS success_id
  FROM public.payment_attempts f
  JOIN LATERAL (
    SELECT id
    FROM public.payment_attempts s
    WHERE s.member_id = f.member_id
      AND s.status = 'succeeded'
      AND s.amount = f.amount
      AND s.created_at >= f.created_at
      AND s.created_at <= f.created_at + interval '10 minutes'
    ORDER BY s.created_at ASC
    LIMIT 1
  ) s ON true
  WHERE f.status IN ('failed','requires_action')
    AND f.superseded_at IS NULL
    AND f.member_id IS NOT NULL
)
UPDATE public.payment_attempts pa
SET
  superseded_by_attempt_id = r.success_id,
  superseded_at = now(),
  resolved_at = COALESCE(pa.resolved_at, now()),
  resolution_note = COALESCE(pa.resolution_note, 'superseded_by_retry_backfill')
FROM retries r
WHERE pa.id = r.failed_id;

-- ============================================================
-- 4. Eligibility helper: single source of truth for check-in
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_member_check_in_eligibility(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_unresolved_membership_arrears boolean := false;
  v_access_granted boolean := true;
  v_denial_reason text := NULL;
BEGIN
  SELECT id, email, status, subscription_status, billing_type,
         stripe_subscription_id, annual_fee_subscription_id
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

  -- Lifecycle status (cancelled is the explicit, narrow definition: marked cancelled in admin)
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

  -- Subscription status (only for non-cash billing)
  IF v_access_granted AND COALESCE(v_member.billing_type,'') <> 'cash'
     AND COALESCE(v_member.subscription_status,'') IN ('past_due','unpaid','canceled','incomplete_expired') THEN
    v_access_granted := false;
    v_denial_reason := 'subscription_' || v_member.subscription_status;
  END IF;

  -- Unresolved MEMBERSHIP arrears only (dues / annual fee invoices).
  -- Cafe/spa/POS declines never block check-in.
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
    'has_unresolved_membership_arrears', v_unresolved_membership_arrears
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_member_check_in_eligibility(uuid) TO authenticated, anon;

-- ============================================================
-- 5. Rewrite process_member_scan to use the helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_member_scan(
  p_member_id_text text,
  p_scanned_by uuid,
  p_auto_check_in boolean DEFAULT false,
  p_device_type text DEFAULT 'manual_entry'::text,
  p_override boolean DEFAULT false,
  p_override_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_log_id uuid;
  v_check_in_id uuid;
  v_access_granted boolean := false;
  v_denial_reason text := NULL;
  v_eligibility jsonb;
  v_payment_status jsonb;
  v_member_id_clean text;
  v_token_timestamp text;
  v_token_parts text[];
  v_is_annual_fee_overdue boolean := false;
  v_is_dues_past_due boolean := false;
BEGIN
  -- Parse QR token (member_id:timestamp:signature)
  IF p_member_id_text LIKE '%:%:%' THEN
    v_token_parts := string_to_array(p_member_id_text, ':');
    v_member_id_clean := v_token_parts[1];
    v_token_timestamp := v_token_parts[2];
    IF (extract(epoch from now()) - v_token_timestamp::bigint) > 300 THEN
      RETURN jsonb_build_object(
        'success', false, 'access_granted', false,
        'error', 'QR code expired',
        'message', 'Please refresh your QR code'
      );
    END IF;
  ELSE
    v_member_id_clean := p_member_id_text;
  END IF;

  -- Find member
  SELECT * INTO v_member
  FROM members
  WHERE member_id ILIKE v_member_id_clean OR id::text = v_member_id_clean
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO scanner_access_logs (
      member_id_text, scanned_by, access_granted, access_denied_reason,
      device_type, scanned_at
    ) VALUES (
      p_member_id_text, p_scanned_by, false, 'member_not_found', p_device_type, now()
    ) RETURNING id INTO v_log_id;
    RETURN jsonb_build_object(
      'success', false, 'access_granted', false,
      'error', 'Member not found',
      'message', 'No member found with ID: ' || p_member_id_text,
      'log_id', v_log_id
    );
  END IF;

  -- Single eligibility decision
  v_eligibility := public.evaluate_member_check_in_eligibility(v_member.id);
  v_access_granted := (v_eligibility->>'access_granted')::boolean;
  v_denial_reason := v_eligibility->>'denial_reason';

  -- Payload kept for backwards compat with frontend (legacy fields)
  IF v_member.annual_fee_paid_at IS NOT NULL THEN
    v_is_annual_fee_overdue := v_member.annual_fee_paid_at < now() - interval '365 days';
  ELSE
    v_is_annual_fee_overdue := v_member.annual_fee_subscription_id IS NULL;
  END IF;
  v_is_dues_past_due := v_member.status = 'past_due';

  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_is_annual_fee_overdue,
    'isDuesPastDue', v_is_dues_past_due,
    'hasRecentFailedPayment', false,
    'hasUnresolvedMembershipArrears', COALESCE((v_eligibility->>'has_unresolved_membership_arrears')::boolean, false)
  );

  -- Override
  IF p_override AND NOT v_access_granted THEN
    v_access_granted := true;
  END IF;

  -- Auto check-in
  IF v_access_granted AND p_auto_check_in THEN
    IF NOT EXISTS(
      SELECT 1 FROM check_ins
      WHERE member_id = v_member.id
        AND checked_in_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO check_ins (member_id, checked_in_by, notes)
      VALUES (
        v_member.id, p_scanned_by,
        CASE WHEN p_override THEN 'OVERRIDE: ' || COALESCE(p_override_reason, 'Admin override') ELSE NULL END
      ) RETURNING id INTO v_check_in_id;
    END IF;
  END IF;

  INSERT INTO scanner_access_logs (
    member_id, member_id_text, scanned_by, access_granted,
    access_denied_reason, auto_checked_in, check_in_id,
    payment_status, device_type, override_used, override_reason, scanned_at
  ) VALUES (
    v_member.id, p_member_id_text, p_scanned_by, v_access_granted,
    CASE WHEN NOT v_access_granted OR p_override THEN v_denial_reason ELSE NULL END,
    v_check_in_id IS NOT NULL, v_check_in_id,
    v_payment_status, p_device_type, p_override, p_override_reason, now()
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'member', jsonb_build_object(
      'id', v_member.id, 'member_id', v_member.member_id,
      'first_name', v_member.first_name, 'last_name', v_member.last_name,
      'status', v_member.status, 'membership_type', v_member.membership_type,
      'email', v_member.email, 'photo_url', v_member.photo_url
    ),
    'payment_status', v_payment_status,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'message', CASE
      WHEN v_access_granted AND p_override THEN 'Access granted with override'
      WHEN v_access_granted THEN 'Access granted'
      ELSE 'Access denied: ' || COALESCE(v_denial_reason, 'unknown reason')
    END
  );
END;
$function$;

-- Drop the legacy 1-arg overload if it still exists, then recreate using the helper too
DROP FUNCTION IF EXISTS public.process_member_scan(text);

-- ============================================================
-- 6. Rewrite kiosk_check_in_member to use the helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.kiosk_check_in_member(p_member_id_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_check_in_id uuid;
  v_today_start timestamptz;
  v_already_checked_in boolean := false;
  v_eligibility jsonb;
  v_access_granted boolean;
  v_denial_reason text;
BEGIN
  v_today_start := date_trunc('day', now());

  SELECT id, member_id, first_name, last_name, status, membership_type, photo_url, email
  INTO v_member
  FROM public.members
  WHERE member_id ILIKE p_member_id_text
     OR email ILIKE p_member_id_text
     OR (first_name || ' ' || last_name) ILIKE '%' || p_member_id_text || '%'
  LIMIT 1;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'access_granted', false,
      'error', 'member_not_found',
      'message', 'No member found with that ID'
    );
  END IF;

  v_eligibility := public.evaluate_member_check_in_eligibility(v_member.id);
  v_access_granted := (v_eligibility->>'access_granted')::boolean;
  v_denial_reason := v_eligibility->>'denial_reason';

  IF NOT v_access_granted THEN
    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', v_denial_reason,
      'member', jsonb_build_object(
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'membership_type', v_member.membership_type,
        'photo_url', v_member.photo_url,
        'status', v_member.status
      )
    );
  END IF;

  -- Already checked in today?
  SELECT EXISTS(
    SELECT 1 FROM public.check_ins
    WHERE member_id = v_member.id
      AND checked_in_at >= v_today_start
      AND checked_out_at IS NULL
  ) INTO v_already_checked_in;

  IF v_already_checked_in THEN
    RETURN jsonb_build_object(
      'success', true, 'access_granted', true, 'already_in', true,
      'member', jsonb_build_object(
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'membership_type', v_member.membership_type,
        'photo_url', v_member.photo_url
      ),
      'message', 'Already checked in today'
    );
  END IF;

  INSERT INTO public.check_ins (member_id, checked_in_at, checked_in_by, notes)
  VALUES (v_member.id, now(), NULL, 'Kiosk check-in')
  RETURNING id INTO v_check_in_id;

  RETURN jsonb_build_object(
    'success', true, 'access_granted', true,
    'check_in_id', v_check_in_id,
    'member', jsonb_build_object(
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'membership_type', v_member.membership_type,
      'photo_url', v_member.photo_url
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_check_in_member(text) TO anon, authenticated;
