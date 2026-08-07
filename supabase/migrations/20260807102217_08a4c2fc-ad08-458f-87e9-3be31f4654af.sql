-- Command 0A verification: kiosk operational RPC containment.
CREATE OR REPLACE FUNCTION public.assert_kiosk_staff()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','cafe_staff','spa_staff','childcare_staff','class_instructor']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.assert_kiosk_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_kiosk_staff() TO authenticated, service_role;

-- Rename implementations, then expose guarded wrappers with identical signatures.
ALTER FUNCTION public.kiosk_todays_attendance() RENAME TO kiosk_todays_attendance_impl;
ALTER FUNCTION public.kiosk_search_visitors(text) RENAME TO kiosk_search_visitors_impl;
ALTER FUNCTION public.kiosk_class_roster(uuid) RENAME TO kiosk_class_roster_impl;
ALTER FUNCTION public.kiosk_kids_care_roster(date) RENAME TO kiosk_kids_care_roster_impl;
ALTER FUNCTION public.kiosk_check_in_member(text) RENAME TO kiosk_check_in_member_impl;
ALTER FUNCTION public.kiosk_check_in_guest(uuid) RENAME TO kiosk_check_in_guest_impl;
ALTER FUNCTION public.kiosk_check_in_class(uuid) RENAME TO kiosk_check_in_class_impl;
ALTER FUNCTION public.kiosk_check_in_spa(uuid) RENAME TO kiosk_check_in_spa_impl;
ALTER FUNCTION public.kiosk_check_in_kids_care(uuid) RENAME TO kiosk_check_in_kids_care_impl;
ALTER FUNCTION public.kiosk_check_out_kids_care(uuid) RENAME TO kiosk_check_out_kids_care_impl;
ALTER FUNCTION public.kiosk_cafe_active_orders() RENAME TO kiosk_cafe_active_orders_impl;
ALTER FUNCTION public.kiosk_cafe_notification_counts() RENAME TO kiosk_cafe_notification_counts_impl;
ALTER FUNCTION public.kiosk_support_notification_counts() RENAME TO kiosk_support_notification_counts_impl;
ALTER FUNCTION public.kiosk_update_cafe_order_status(uuid, text) RENAME TO kiosk_update_cafe_order_status_impl;
ALTER FUNCTION public.kiosk_adjust_member_credits(uuid, integer, text) RENAME TO kiosk_adjust_member_credits_impl;
ALTER FUNCTION public.kiosk_acknowledge_conversation(uuid, text, boolean) RENAME TO kiosk_acknowledge_conversation_impl;

REVOKE EXECUTE ON FUNCTION public.kiosk_todays_attendance_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_search_visitors_impl(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_class_roster_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_kids_care_roster_impl(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_member_impl(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_guest_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_class_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_spa_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_kids_care_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_out_kids_care_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_cafe_active_orders_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_cafe_notification_counts_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_support_notification_counts_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_update_cafe_order_status_impl(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_adjust_member_credits_impl(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_acknowledge_conversation_impl(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_todays_attendance_impl(); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_search_visitors(p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_search_visitors_impl(p_query); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_class_roster(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_class_roster_impl(p_session_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_kids_care_roster(p_booking_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_kids_care_roster_impl(p_booking_date); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_member(p_member_id_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_in_member_impl(p_member_id_text); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_guest(p_guest_pass_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_in_guest_impl(p_guest_pass_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_class(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_in_class_impl(p_booking_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_spa(p_spa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_in_spa_impl(p_spa_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_kids_care(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_in_kids_care_impl(p_booking_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_check_out_kids_care(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_check_out_kids_care_impl(p_booking_id); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_cafe_active_orders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_cafe_active_orders_impl(); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_cafe_notification_counts()
RETURNS TABLE(pending_count integer, preparing_count integer, total_active_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN QUERY SELECT * FROM public.kiosk_cafe_notification_counts_impl(); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_support_notification_counts()
RETURNS TABLE(open_count integer, unread_count integer, unacknowledged_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN QUERY SELECT * FROM public.kiosk_support_notification_counts_impl(); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_update_cafe_order_status(p_order_id uuid, p_new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); PERFORM public.kiosk_update_cafe_order_status_impl(p_order_id, p_new_status); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_adjust_member_credits(p_credit_id uuid, p_delta integer, p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN public.kiosk_adjust_member_credits_impl(p_credit_id, p_delta, p_reason); END; $fn$;

CREATE OR REPLACE FUNCTION public.kiosk_acknowledge_conversation(p_conversation_id uuid, p_staff_name text DEFAULT NULL::text, p_acknowledged boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ BEGIN PERFORM public.assert_kiosk_staff(); PERFORM public.kiosk_acknowledge_conversation_impl(p_conversation_id, p_staff_name, p_acknowledged); END; $fn$;

REVOKE EXECUTE ON FUNCTION public.kiosk_todays_attendance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_search_visitors(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_class_roster(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_kids_care_roster(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_member(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_guest(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_class(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_spa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_in_kids_care(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_check_out_kids_care(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_cafe_active_orders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_cafe_notification_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_support_notification_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_update_cafe_order_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_adjust_member_credits(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_acknowledge_conversation(uuid, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_search_visitors(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_class_roster(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_kids_care_roster(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_member(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_guest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_class(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_spa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_kids_care(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_check_out_kids_care(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_cafe_active_orders() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_cafe_notification_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_support_notification_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_update_cafe_order_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_adjust_member_credits(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_acknowledge_conversation(uuid, text, boolean) TO authenticated, service_role;

-- Event ticket check-in: deny anonymous callers (logic defect fix).
CREATE OR REPLACE FUNCTION public.frontdesk_event_ticket_check_in(p_ticket_id uuid, p_checked_in boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.event_tickets%ROWTYPE;
BEGIN
  IF v_uid IS NULL
     OR NOT public.has_any_role(v_uid, ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_row FROM public.event_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;
  IF v_row.status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not paid');
  END IF;

  IF p_checked_in THEN
    UPDATE public.event_tickets SET checked_in_at = COALESCE(checked_in_at, now())
     WHERE id = p_ticket_id RETURNING * INTO v_row;
  ELSE
    UPDATE public.event_tickets SET checked_in_at = NULL
     WHERE id = p_ticket_id RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('success', true, 'checked_in_at', v_row.checked_in_at);
END;
$fn$;