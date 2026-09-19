CREATE OR REPLACE FUNCTION public.cancel_event_reservation(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _event public.events%ROWTYPE;
  _ticket public.event_tickets%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO _ticket FROM public.event_tickets
  WHERE event_id = _event.id AND user_id = _uid AND status = 'paid'
  ORDER BY created_at DESC LIMIT 1;

  IF _ticket.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reservation');
  END IF;

  -- Complimentary member reservations only; paid tickets go through staff refunds.
  IF coalesce(_ticket.amount_cents, 0) <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paid_ticket');
  END IF;

  UPDATE public.event_tickets
    SET status = 'abandoned',
        abandon_reason = 'member_cancelled',
        abandoned_at = now()
  WHERE id = _ticket.id;

  RETURN jsonb_build_object('ok', true, 'ticket_id', _ticket.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_event_reservation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event_reservation(text) TO authenticated;