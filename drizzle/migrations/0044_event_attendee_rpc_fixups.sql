CREATE OR REPLACE FUNCTION public.admin_add_event_attendee(
  _event_id uuid,
  _first_name text,
  _last_name text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _ticket_type text DEFAULT 'member',
  _amount_cents integer DEFAULT 0,
  _payment_note text DEFAULT NULL,
  _override boolean DEFAULT false,
  _override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _event public.events%ROWTYPE;
  _sold int;
  _ticket_id uuid;
  _is_manager boolean;
BEGIN
  IF NOT public.has_any_role(_actor, ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  _is_manager := public.has_any_role(_actor, ARRAY['super_admin','admin','manager']::app_role[]);

  SELECT * INTO _event FROM public.events WHERE id = _event_id;
  IF _event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF coalesce(trim(_first_name),'') = '' OR coalesce(trim(_last_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;

  IF _ticket_type NOT IN ('member','non_member') THEN
    _ticket_type := 'member';
  END IF;

  SELECT count(*)::int INTO _sold FROM public.event_tickets t
  WHERE t.event_id = _event.id
    AND (t.status = 'paid' OR (t.status = 'pending' AND t.created_at > now() - interval '15 minutes'));

  IF _event.capacity IS NOT NULL AND _sold >= _event.capacity THEN
    IF NOT (_override AND _is_manager AND coalesce(trim(_override_reason),'') <> '') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'full');
    END IF;
  END IF;

  INSERT INTO public.event_tickets (
    event_id, user_id, buyer_email, buyer_first_name, buyer_last_name, buyer_phone,
    attendee_first_name, attendee_last_name, attendee_email, attendee_phone,
    ticket_type, amount_cents, status
  ) VALUES (
    _event.id, _user_id, lower(nullif(trim(coalesce(_email,'')), '')),
    trim(_first_name), trim(_last_name), nullif(trim(coalesce(_phone,'')), ''),
    trim(_first_name), trim(_last_name), lower(nullif(trim(coalesce(_email,'')), '')),
    nullif(trim(coalesce(_phone,'')), ''),
    _ticket_type, greatest(coalesce(_amount_cents,0),0), 'paid'
  )
  RETURNING id INTO _ticket_id;

  INSERT INTO public.admin_action_log (action_type, action_data, performed_by, can_undo)
  VALUES ('event_attendee_added',
    jsonb_build_object(
      'ticket_id', _ticket_id,
      'event_id', _event.id, 'event_slug', _event.slug,
      'name', trim(_first_name) || ' ' || trim(_last_name),
      'email', _email, 'ticket_type', _ticket_type,
      'amount_cents', coalesce(_amount_cents,0),
      'payment_note', _payment_note,
      'override', _override, 'override_reason', _override_reason),
    _actor, false);

  RETURN jsonb_build_object('ok', true, 'ticket_id', _ticket_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_event_attendee(
  _ticket_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _ticket public.event_tickets%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(_actor, ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO _ticket FROM public.event_tickets WHERE id = _ticket_id;
  IF _ticket.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.event_tickets
    SET status = 'cancelled',
        abandon_reason = coalesce(nullif(trim(coalesce(_reason,'')), ''), 'removed_by_staff'),
        abandoned_at = now()
  WHERE id = _ticket_id;

  INSERT INTO public.admin_action_log (action_type, action_data, performed_by, can_undo)
  VALUES ('event_attendee_removed',
    jsonb_build_object('ticket_id', _ticket_id, 'event_id', _ticket.event_id,
      'reason', _reason, 'amount_cents', _ticket.amount_cents),
    _actor, false);

  RETURN jsonb_build_object('ok', true);
END;
$function$;