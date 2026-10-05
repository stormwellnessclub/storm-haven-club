CREATE OR REPLACE FUNCTION public.admin_cancel_class_session(_session_id uuid, _is_hidden boolean DEFAULT false, _cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _booking RECORD;
  _refunded_count integer := 0;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to cancel classes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM class_sessions WHERE id = _session_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  FOR _booking IN
    SELECT id, payment_method, member_credit_id, credits_used, pass_id
    FROM class_bookings WHERE session_id = _session_id AND status IN ('confirmed','completed')
  LOOP
    IF _booking.payment_method = 'credits' AND _booking.member_credit_id IS NOT NULL THEN
      UPDATE member_credits SET credits_remaining = credits_remaining + COALESCE(_booking.credits_used, 1) WHERE id = _booking.member_credit_id;
    END IF;
    IF _booking.payment_method = 'pass' AND _booking.pass_id IS NOT NULL THEN
      UPDATE class_passes SET classes_remaining = classes_remaining + 1, status = 'active' WHERE id = _booking.pass_id;
    END IF;
    UPDATE class_bookings SET status = 'cancelled', cancellation_reason = 'Class cancelled by admin', cancelled_at = now() WHERE id = _booking.id;
    _refunded_count := _refunded_count + 1;
  END LOOP;
  UPDATE class_sessions SET is_cancelled = true, is_hidden = _is_hidden, cancellation_reason = _cancellation_reason WHERE id = _session_id;
  RETURN jsonb_build_object('success', true, 'refunded_count', _refunded_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_class_session_hidden(_session_id uuid, _is_hidden boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to hide classes';
  END IF;
  UPDATE class_sessions SET is_hidden = _is_hidden WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_class_session_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_class_session_hidden(uuid, boolean) TO authenticated;