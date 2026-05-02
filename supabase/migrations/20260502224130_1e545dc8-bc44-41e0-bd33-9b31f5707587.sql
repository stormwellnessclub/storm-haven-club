
ALTER TABLE public.class_waitlist
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS pass_id uuid REFERENCES public.class_passes(id),
  ADD COLUMN IF NOT EXISTS member_credit_id uuid REFERENCES public.member_credits(id),
  ADD COLUMN IF NOT EXISTS credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hold_refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE OR REPLACE FUNCTION public.join_waitlist_with_hold(
  p_session_id uuid,
  p_method text,
  p_pass_id uuid DEFAULT NULL,
  p_credit_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_member_id uuid;
  v_position integer;
  v_pass_remaining integer;
  v_credit_remaining integer;
  v_session_full boolean;
  v_waitlist_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_method NOT IN ('credits','pass') THEN
    RAISE EXCEPTION 'Unsupported waitlist payment method: %', p_method;
  END IF;

  -- Block duplicate active waitlist entries
  IF EXISTS (
    SELECT 1 FROM public.class_waitlist
    WHERE session_id = p_session_id AND user_id = v_user
      AND status IN ('waiting','notified')
  ) THEN
    RAISE EXCEPTION 'You are already on the waitlist for this class';
  END IF;

  -- Look up member id (may be null for non-members)
  SELECT id INTO v_member_id FROM public.members WHERE user_id = v_user LIMIT 1;

  -- Verify class is actually full (we only hold when full)
  SELECT current_enrollment >= max_capacity INTO v_session_full
  FROM public.class_sessions WHERE id = p_session_id;
  IF NOT COALESCE(v_session_full, false) THEN
    RAISE EXCEPTION 'Class still has open spots — please book directly';
  END IF;

  -- Hold the payment
  IF p_method = 'pass' THEN
    IF p_pass_id IS NULL THEN RAISE EXCEPTION 'Select a class pass'; END IF;
    SELECT classes_remaining INTO v_pass_remaining
    FROM public.class_passes
    WHERE id = p_pass_id AND user_id = v_user
      AND status = 'active' AND classes_remaining > 0
      AND expires_at > now()
    FOR UPDATE;
    IF v_pass_remaining IS NULL THEN
      RAISE EXCEPTION 'Selected pass is not available';
    END IF;
    UPDATE public.class_passes
    SET classes_remaining = classes_remaining - 1,
        status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END,
        updated_at = now()
    WHERE id = p_pass_id;
  ELSIF p_method = 'credits' THEN
    IF v_member_id IS NULL THEN
      RAISE EXCEPTION 'Only members can hold a credit on the waitlist';
    END IF;
    IF p_credit_id IS NULL THEN
      SELECT id INTO p_credit_id FROM public.member_credits
      WHERE member_id = v_member_id AND credit_type = 'class'
        AND credits_remaining > 0 AND expires_at > now()
      ORDER BY expires_at ASC
      LIMIT 1
      FOR UPDATE;
    ELSE
      PERFORM 1 FROM public.member_credits WHERE id = p_credit_id FOR UPDATE;
    END IF;
    IF p_credit_id IS NULL THEN RAISE EXCEPTION 'No class credits available'; END IF;
    SELECT credits_remaining INTO v_credit_remaining
    FROM public.member_credits WHERE id = p_credit_id;
    IF v_credit_remaining IS NULL OR v_credit_remaining <= 0 THEN
      RAISE EXCEPTION 'No class credits remaining';
    END IF;
    UPDATE public.member_credits
    SET credits_remaining = credits_remaining - 1, updated_at = now()
    WHERE id = p_credit_id;
  END IF;

  -- Next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM public.class_waitlist WHERE session_id = p_session_id;

  INSERT INTO public.class_waitlist (
    session_id, user_id, position, status,
    payment_method, pass_id, member_credit_id, credits_used
  ) VALUES (
    p_session_id, v_user, v_position, 'waiting',
    p_method,
    CASE WHEN p_method = 'pass' THEN p_pass_id END,
    CASE WHEN p_method = 'credits' THEN p_credit_id END,
    CASE WHEN p_method = 'credits' THEN 1 ELSE 0 END
  ) RETURNING id INTO v_waitlist_id;

  RETURN jsonb_build_object(
    'waitlist_id', v_waitlist_id,
    'position', v_position,
    'payment_method', p_method
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_waitlist_hold(p_waitlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.class_waitlist%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.class_waitlist WHERE id = p_waitlist_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_entry.hold_refunded THEN RETURN; END IF;

  IF v_entry.payment_method = 'pass' AND v_entry.pass_id IS NOT NULL THEN
    UPDATE public.class_passes
    SET classes_remaining = classes_remaining + 1,
        status = 'active'::pass_status,
        updated_at = now()
    WHERE id = v_entry.pass_id;
  ELSIF v_entry.payment_method = 'credits' AND v_entry.member_credit_id IS NOT NULL THEN
    UPDATE public.member_credits
    SET credits_remaining = credits_remaining + GREATEST(v_entry.credits_used, 1),
        updated_at = now()
    WHERE id = v_entry.member_credit_id;
  END IF;

  UPDATE public.class_waitlist
  SET hold_refunded = true, refunded_at = now(), updated_at = now()
  WHERE id = p_waitlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist_with_hold(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_waitlist_hold(uuid) TO authenticated, service_role;
