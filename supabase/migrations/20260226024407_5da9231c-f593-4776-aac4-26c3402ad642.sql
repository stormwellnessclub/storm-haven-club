
CREATE OR REPLACE FUNCTION public.admin_cancel_class_session(
  _session_id uuid,
  _is_hidden boolean DEFAULT false,
  _cancellation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _booking RECORD;
  _refunded_count integer := 0;
BEGIN
  -- Validate caller is admin/manager/super_admin
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin role required');
  END IF;

  -- Verify session exists
  IF NOT EXISTS (SELECT 1 FROM class_sessions WHERE id = _session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Loop through all confirmed bookings and restore credits/passes
  FOR _booking IN
    SELECT id, payment_method, member_credit_id, credits_used, pass_id
    FROM class_bookings
    WHERE session_id = _session_id AND status = 'confirmed'
  LOOP
    -- Restore credits
    IF _booking.payment_method = 'credits' AND _booking.member_credit_id IS NOT NULL THEN
      UPDATE member_credits
      SET credits_remaining = credits_remaining + COALESCE(_booking.credits_used, 1)
      WHERE id = _booking.member_credit_id;
    END IF;

    -- Restore pass
    IF _booking.payment_method = 'pass' AND _booking.pass_id IS NOT NULL THEN
      UPDATE class_passes
      SET classes_remaining = classes_remaining + 1,
          status = 'active'
      WHERE id = _booking.pass_id;
    END IF;

    -- Cancel the booking
    UPDATE class_bookings
    SET status = 'cancelled',
        cancellation_reason = 'Class cancelled by admin',
        cancelled_at = now()
    WHERE id = _booking.id;

    _refunded_count := _refunded_count + 1;
  END LOOP;

  -- Mark session as cancelled
  UPDATE class_sessions
  SET is_cancelled = true,
      is_hidden = _is_hidden,
      cancellation_reason = _cancellation_reason
  WHERE id = _session_id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_count', _refunded_count
  );
END;
$$;
