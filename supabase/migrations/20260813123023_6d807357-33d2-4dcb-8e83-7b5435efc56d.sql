CREATE OR REPLACE FUNCTION public.kiosk_send_staff_reply(p_conversation_id uuid, p_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_name text;
  v_id uuid;
BEGIN
  PERFORM public.assert_kiosk_staff();

  IF p_message IS NULL OR btrim(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required' USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();

  SELECT NULLIF(btrim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), '')
    INTO v_name
    FROM public.profiles pr
   WHERE pr.user_id = auth.uid()
   LIMIT 1;

  INSERT INTO public.email_messages (conversation_id, sender_type, sender_email, sender_name, message_body, is_read)
  VALUES (p_conversation_id, 'staff', coalesce(v_email, ''), coalesce(v_name, 'Storm Wellness Staff'), p_message, true)
  RETURNING id INTO v_id;

  UPDATE public.email_conversations
     SET status = CASE WHEN status IN ('resolved'::conversation_status, 'closed'::conversation_status)
                       THEN status ELSE 'in_progress'::conversation_status END,
         last_message_at = now(),
         updated_at = now()
   WHERE id = p_conversation_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_mark_conversation_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM public.assert_kiosk_staff();

  UPDATE public.email_messages
     SET is_read = true
   WHERE conversation_id = p_conversation_id
     AND sender_type = 'member'
     AND is_read = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_set_conversation_status(p_conversation_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM public.assert_kiosk_staff();

  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.email_conversations
     SET status = p_status::conversation_status,
         updated_at = now()
   WHERE id = p_conversation_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_send_staff_reply(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_set_conversation_status(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.kiosk_send_staff_reply(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_mark_conversation_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_set_conversation_status(uuid, text) TO authenticated, service_role;