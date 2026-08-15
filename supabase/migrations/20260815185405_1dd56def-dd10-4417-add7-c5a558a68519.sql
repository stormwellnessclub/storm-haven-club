CREATE OR REPLACE FUNCTION public.post_concierge_auto_reply(p_conversation_id uuid, p_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_message IS NULL OR btrim(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_conversations c
    WHERE c.id = p_conversation_id
      AND c.user_id = auth.uid()
      AND c.category = 'concierge'
  ) THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.email_messages (conversation_id, sender_type, sender_email, sender_name, message_body, is_read)
  VALUES (p_conversation_id, 'staff', 'concierge@stormwellnessclub.com', 'Storm Wellness Club', btrim(p_message), true)
  RETURNING id INTO v_id;

  UPDATE public.email_conversations
     SET last_message_at = now()
   WHERE id = p_conversation_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_concierge_auto_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_concierge_auto_reply(uuid, text) TO authenticated, service_role;