CREATE OR REPLACE FUNCTION public.kiosk_resolve_conversation(
  p_conversation_id uuid,
  p_resolved boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM public.assert_kiosk_staff();

  UPDATE public.email_conversations
     SET status = CASE WHEN p_resolved THEN 'resolved'::conversation_status ELSE 'open'::conversation_status END,
         updated_at = now()
   WHERE id = p_conversation_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kiosk_resolve_conversation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_resolve_conversation(uuid, boolean) TO authenticated, service_role;