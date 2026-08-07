ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_by_name text;

-- Clear acknowledgement when a member posts a new message
CREATE OR REPLACE FUNCTION public.clear_conversation_ack_on_member_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'member' THEN
    UPDATE public.email_conversations
       SET acknowledged_at = NULL,
           acknowledged_by = NULL,
           acknowledged_by_name = NULL
     WHERE id = NEW.conversation_id
       AND acknowledged_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_conversation_ack_on_member_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clear_conversation_ack ON public.email_messages;
CREATE TRIGGER trg_clear_conversation_ack
AFTER INSERT ON public.email_messages
FOR EACH ROW EXECUTE FUNCTION public.clear_conversation_ack_on_member_message();

-- Acknowledge ("mark received") a conversation. Usable by staff and by the front desk kiosk.
CREATE OR REPLACE FUNCTION public.kiosk_acknowledge_conversation(
  p_conversation_id uuid,
  p_staff_name text DEFAULT NULL,
  p_acknowledged boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_acknowledged THEN
    UPDATE public.email_conversations
       SET acknowledged_at = now(),
           acknowledged_by = auth.uid(),
           acknowledged_by_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), 'Front Desk')
     WHERE id = p_conversation_id;
  ELSE
    UPDATE public.email_conversations
       SET acknowledged_at = NULL,
           acknowledged_by = NULL,
           acknowledged_by_name = NULL
     WHERE id = p_conversation_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kiosk_acknowledge_conversation(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_acknowledge_conversation(uuid, text, boolean) TO anon, authenticated;

-- Counts now include unacknowledged requests
DROP FUNCTION IF EXISTS public.kiosk_support_notification_counts();
CREATE OR REPLACE FUNCTION public.kiosk_support_notification_counts()
RETURNS TABLE(open_count integer, unread_count integer, unacknowledged_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
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
        AND ec.status IN ('open','in_progress'))                           AS unread_count,
    (SELECT COUNT(*)::int
       FROM public.email_conversations
      WHERE status IN ('open','in_progress')
        AND acknowledged_at IS NULL)                                       AS unacknowledged_count;
$$;

REVOKE EXECUTE ON FUNCTION public.kiosk_support_notification_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_support_notification_counts() TO anon, authenticated;