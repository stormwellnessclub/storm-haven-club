
-- ── Cafe notification counts (banner + chime)
CREATE OR REPLACE FUNCTION public.kiosk_cafe_notification_counts()
RETURNS TABLE(pending_count int, preparing_count int, total_active_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending_count,
    COUNT(*) FILTER (WHERE status = 'preparing')::int AS preparing_count,
    COUNT(*) FILTER (WHERE status IN ('pending','preparing'))::int AS total_active_count
  FROM public.cafe_orders;
$$;

REVOKE ALL ON FUNCTION public.kiosk_cafe_notification_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_cafe_notification_counts() TO anon, authenticated;

-- ── Active cafe orders for the front desk queue
CREATE OR REPLACE FUNCTION public.kiosk_cafe_active_orders()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at ASC), '[]'::jsonb)
  FROM (
    SELECT
      co.id,
      co.member_id,
      co.user_id,
      co.order_items,
      co.total_amount,
      co.status,
      co.payment_method,
      co.payment_intent_id,
      co.estimated_ready_at,
      co.created_at,
      co.updated_at,
      co.completed_at,
      co.note,
      CASE WHEN m.id IS NOT NULL THEN
        jsonb_build_object(
          'id', m.id,
          'first_name', m.first_name,
          'last_name',  m.last_name,
          'email',      m.email
        )
      END AS member,
      CASE WHEN m.id IS NULL AND nm.user_id IS NOT NULL THEN
        jsonb_build_object(
          'id',         nm.user_id,
          'email',      nm.email,
          'first_name', nm.first_name,
          'last_name',  nm.last_name,
          'phone',      nm.phone
        )
      END AS "user"
    FROM public.cafe_orders co
    LEFT JOIN public.members             m  ON m.id       = co.member_id
    LEFT JOIN public.non_member_profiles nm ON nm.user_id = co.user_id AND m.id IS NULL
    WHERE co.status IN ('pending','preparing','ready')
       OR (co.status = 'completed' AND co.completed_at > now() - interval '2 hours')
    ORDER BY co.created_at ASC
  ) o;
$$;

REVOKE ALL ON FUNCTION public.kiosk_cafe_active_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_cafe_active_orders() TO anon, authenticated;

-- ── Update cafe order status from the kiosk / front desk
CREATE OR REPLACE FUNCTION public.kiosk_update_cafe_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_new_status NOT IN ('pending','preparing','ready','completed','cancelled') THEN
    RAISE EXCEPTION 'invalid status: %', p_new_status;
  END IF;

  UPDATE public.cafe_orders
     SET status       = p_new_status,
         updated_at   = now(),
         completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE NULL END
   WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_update_cafe_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_update_cafe_order_status(uuid, text) TO anon, authenticated;

-- ── Support / concierge counts (banner + chime)
CREATE OR REPLACE FUNCTION public.kiosk_support_notification_counts()
RETURNS TABLE(open_count int, unread_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int
       FROM public.email_conversations
       WHERE status IN ('open','in_progress'))                              AS open_count,
    (SELECT COUNT(*)::int
       FROM public.email_messages em
       JOIN public.email_conversations ec ON ec.id = em.conversation_id
      WHERE em.sender_type = 'member'
        AND em.is_read = false
        AND ec.status IN ('open','in_progress'))                             AS unread_count;
$$;

REVOKE ALL ON FUNCTION public.kiosk_support_notification_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_support_notification_counts() TO anon, authenticated;
