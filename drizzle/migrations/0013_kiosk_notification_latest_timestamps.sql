DROP FUNCTION IF EXISTS public.kiosk_cafe_notification_counts();
DROP FUNCTION IF EXISTS public.kiosk_cafe_notification_counts_impl();
DROP FUNCTION IF EXISTS public.kiosk_support_notification_counts();
DROP FUNCTION IF EXISTS public.kiosk_support_notification_counts_impl();

CREATE OR REPLACE FUNCTION public.kiosk_cafe_notification_counts_impl()
RETURNS TABLE(pending_count integer, preparing_count integer, total_active_count integer, latest_order_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending_count,
    COUNT(*) FILTER (WHERE status = 'preparing')::int AS preparing_count,
    COUNT(*) FILTER (WHERE status IN ('pending','preparing'))::int AS total_active_count,
    MAX(created_at) FILTER (WHERE status IN ('pending','preparing')) AS latest_order_at
  FROM public.cafe_orders;
$function$;

CREATE OR REPLACE FUNCTION public.kiosk_cafe_notification_counts()
RETURNS TABLE(pending_count integer, preparing_count integer, total_active_count integer, latest_order_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN QUERY SELECT * FROM public.kiosk_cafe_notification_counts_impl(); END; $function$;

CREATE OR REPLACE FUNCTION public.kiosk_support_notification_counts_impl()
RETURNS TABLE(open_count integer, unread_count integer, unacknowledged_count integer, latest_member_message_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*)::int
       FROM public.email_conversations
      WHERE status IN ('open','in_progress'))                              AS open_count,
    (SELECT COUNT(*)::int
       FROM public.email_messages em
       JOIN public.email_conversations ec ON ec.id = em.conversation_id
      WHERE em.sender_type = 'member'
        AND em.is_read = false
        AND ec.status IN ('open','in_progress'))                           AS unread_count,
    (SELECT COUNT(*)::int
       FROM public.email_conversations
      WHERE status IN ('open','in_progress')
        AND acknowledged_at IS NULL)                                       AS unacknowledged_count,
    (SELECT MAX(created_at)
       FROM public.email_messages
      WHERE sender_type = 'member')                                        AS latest_member_message_at;
$function$;

CREATE OR REPLACE FUNCTION public.kiosk_support_notification_counts()
RETURNS TABLE(open_count integer, unread_count integer, unacknowledged_count integer, latest_member_message_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$ BEGIN PERFORM public.assert_kiosk_staff(); RETURN QUERY SELECT * FROM public.kiosk_support_notification_counts_impl(); END; $function$;

REVOKE ALL ON FUNCTION public.kiosk_cafe_notification_counts_impl() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kiosk_support_notification_counts_impl() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_cafe_notification_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_support_notification_counts() TO authenticated, service_role;