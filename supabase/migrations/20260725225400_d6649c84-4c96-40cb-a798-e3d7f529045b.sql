
CREATE OR REPLACE FUNCTION public.frontdesk_event_ticket_check_in(p_ticket_id uuid, p_checked_in boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.event_tickets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_any_role(v_uid, ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
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
    UPDATE public.event_tickets
       SET checked_in_at = COALESCE(checked_in_at, now())
     WHERE id = p_ticket_id
     RETURNING * INTO v_row;
  ELSE
    UPDATE public.event_tickets
       SET checked_in_at = NULL
     WHERE id = p_ticket_id
     RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('success', true, 'checked_in_at', v_row.checked_in_at);
END;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_event_ticket_check_in(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_event_ticket_check_in(uuid, boolean) TO authenticated;
