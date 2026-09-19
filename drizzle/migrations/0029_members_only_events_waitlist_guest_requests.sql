-- 1. Event flags
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS members_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_guest_requests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_capacity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle text;

-- 2. Waitlist
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid,
  first_name text,
  last_name text,
  email text NOT NULL,
  phone text,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS event_waitlist_unique_email
  ON public.event_waitlist (event_id, lower(email))
  WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS event_waitlist_event_pos ON public.event_waitlist (event_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_waitlist TO authenticated;
GRANT ALL ON public.event_waitlist TO service_role;
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own waitlist rows"
  ON public.event_waitlist FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR lower(email) = (SELECT public.current_user_email_lower()));

CREATE POLICY "Staff manage event waitlist"
  ON public.event_waitlist FOR ALL TO authenticated
  USING ((SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[])))
  WITH CHECK ((SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

-- 3. Guest seat requests
CREATE TABLE IF NOT EXISTS public.event_guest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by_user_id uuid,
  requester_email text NOT NULL,
  requester_name text,
  guest_first_name text NOT NULL,
  guest_last_name text NOT NULL,
  guest_email text,
  guest_phone text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_guest_requests_event ON public.event_guest_requests (event_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_guest_requests TO authenticated;
GRANT ALL ON public.event_guest_requests TO service_role;
ALTER TABLE public.event_guest_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own guest requests"
  ON public.event_guest_requests FOR SELECT TO authenticated
  USING (requested_by_user_id = (SELECT auth.uid()) OR lower(requester_email) = (SELECT public.current_user_email_lower()));

CREATE POLICY "Staff manage event guest requests"
  ON public.event_guest_requests FOR ALL TO authenticated
  USING ((SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[])))
  WITH CHECK ((SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

-- 4. Member-facing state (no counts leaked)
CREATE OR REPLACE FUNCTION public.get_event_member_state(_slug text)
RETURNS TABLE(is_member boolean, has_reservation boolean, is_waitlisted boolean, is_full boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(public.current_user_email(), ''));
  _event public.events%ROWTYPE;
  _sold int;
BEGIN
  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL THEN RETURN; END IF;

  is_member := EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.status IN ('active','frozen')
      AND (( _uid IS NOT NULL AND m.user_id = _uid) OR (_email <> '' AND lower(m.email) = _email))
  );

  has_reservation := EXISTS (
    SELECT 1 FROM public.event_tickets t
    WHERE t.event_id = _event.id AND t.status = 'paid'
      AND ((_uid IS NOT NULL AND t.user_id = _uid) OR (_email <> '' AND lower(t.buyer_email) = _email))
  );

  is_waitlisted := EXISTS (
    SELECT 1 FROM public.event_waitlist w
    WHERE w.event_id = _event.id AND w.status = 'waiting'
      AND ((_uid IS NOT NULL AND w.user_id = _uid) OR (_email <> '' AND lower(w.email) = _email))
  );

  SELECT count(*)::int INTO _sold FROM public.event_tickets t
  WHERE t.event_id = _event.id
    AND (t.status = 'paid' OR (t.status = 'pending' AND t.created_at > now() - interval '15 minutes'));

  is_full := coalesce(_sold,0) >= _event.capacity;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_event_member_state(text) TO authenticated, anon;

-- 5. Complimentary member reservation
CREATE OR REPLACE FUNCTION public.reserve_event_seat(_slug text, _phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.events%ROWTYPE;
  _member public.members%ROWTYPE;
  _sold int;
  _ticket_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF _event.status NOT IN ('on_sale','published') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open');
  END IF;

  SELECT * INTO _member FROM public.members
  WHERE user_id = _uid AND status IN ('active','frozen')
  LIMIT 1;
  IF _member.id IS NULL THEN
    SELECT * INTO _member FROM public.members
    WHERE lower(email) = lower(coalesce(public.current_user_email(), '')) AND status IN ('active','frozen')
    LIMIT 1;
  END IF;
  IF _member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_tickets t
    WHERE t.event_id = _event.id AND t.status = 'paid' AND t.user_id = _uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_reserved');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_event.id::text));

  SELECT count(*)::int INTO _sold FROM public.event_tickets t
  WHERE t.event_id = _event.id
    AND (t.status = 'paid' OR (t.status = 'pending' AND t.created_at > now() - interval '15 minutes'));

  IF coalesce(_sold,0) >= _event.capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.event_tickets (
    event_id, user_id, buyer_email, buyer_first_name, buyer_last_name, buyer_phone,
    ticket_type, amount_cents, status
  ) VALUES (
    _event.id, _uid, lower(_member.email), _member.first_name, _member.last_name,
    coalesce(_phone, _member.phone), 'member', 0, 'paid'
  ) RETURNING id INTO _ticket_id;

  UPDATE public.event_waitlist
    SET status = 'converted', updated_at = now()
  WHERE event_id = _event.id AND status = 'waiting' AND user_id = _uid;

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'reserved', 'ticket_id', _ticket_id,
    'email', lower(_member.email),
    'first_name', _member.first_name, 'last_name', _member.last_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reserve_event_seat(text, text) TO authenticated;

-- 6. Join waitlist
CREATE OR REPLACE FUNCTION public.join_event_waitlist(_slug text, _phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.events%ROWTYPE;
  _member public.members%ROWTYPE;
  _pos int;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;

  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  SELECT * INTO _member FROM public.members
  WHERE user_id = _uid AND status IN ('active','frozen') LIMIT 1;
  IF _member.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_member'); END IF;

  IF EXISTS (SELECT 1 FROM public.event_waitlist w
             WHERE w.event_id = _event.id AND w.status = 'waiting' AND w.user_id = _uid) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_waitlisted');
  END IF;

  SELECT coalesce(max(position),0) + 1 INTO _pos
  FROM public.event_waitlist WHERE event_id = _event.id;

  INSERT INTO public.event_waitlist (event_id, user_id, first_name, last_name, email, phone, position)
  VALUES (_event.id, _uid, _member.first_name, _member.last_name, lower(_member.email),
          coalesce(_phone, _member.phone), _pos);

  RETURN jsonb_build_object('ok', true, 'reason', 'waitlisted');
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_event_waitlist(text, text) TO authenticated;

-- 7. Guest seat request
CREATE OR REPLACE FUNCTION public.request_event_guest_seat(
  _slug text, _guest_first_name text, _guest_last_name text,
  _guest_email text DEFAULT NULL, _guest_phone text DEFAULT NULL, _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.events%ROWTYPE;
  _member public.members%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  IF coalesce(trim(_guest_first_name),'') = '' OR coalesce(trim(_guest_last_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_name');
  END IF;

  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL OR NOT _event.allow_guest_requests THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;

  SELECT * INTO _member FROM public.members
  WHERE user_id = _uid AND status IN ('active','frozen') LIMIT 1;
  IF _member.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_member'); END IF;

  INSERT INTO public.event_guest_requests (
    event_id, requested_by_user_id, requester_email, requester_name,
    guest_first_name, guest_last_name, guest_email, guest_phone, note
  ) VALUES (
    _event.id, _uid, lower(_member.email),
    trim(coalesce(_member.first_name,'') || ' ' || coalesce(_member.last_name,'')),
    left(trim(_guest_first_name), 80), left(trim(_guest_last_name), 80),
    nullif(lower(trim(coalesce(_guest_email,''))), ''), nullif(trim(coalesce(_guest_phone,'')), ''),
    left(coalesce(_note,''), 1000)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_event_guest_seat(text, text, text, text, text, text) TO authenticated;

-- 8. Staff: approve a guest request (issues the seat atomically)
CREATE OR REPLACE FUNCTION public.approve_event_guest_request(_request_id uuid, _amount_cents integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _req public.event_guest_requests%ROWTYPE;
  _event public.events%ROWTYPE;
  _sold int;
  _ticket_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _req FROM public.event_guest_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _req.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_decided'); END IF;

  SELECT * INTO _event FROM public.events WHERE id = _req.event_id;

  PERFORM pg_advisory_xact_lock(hashtext(_event.id::text));
  SELECT count(*)::int INTO _sold FROM public.event_tickets t
  WHERE t.event_id = _event.id
    AND (t.status = 'paid' OR (t.status = 'pending' AND t.created_at > now() - interval '15 minutes'));
  IF coalesce(_sold,0) >= _event.capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.event_tickets (
    event_id, user_id, buyer_email, buyer_first_name, buyer_last_name, buyer_phone,
    attendee_first_name, attendee_last_name, attendee_email, attendee_phone,
    is_gift, gifted_by_user_id, ticket_type, amount_cents, status
  ) VALUES (
    _event.id, NULL, coalesce(_req.guest_email, _req.requester_email),
    _req.guest_first_name, _req.guest_last_name, _req.guest_phone,
    _req.guest_first_name, _req.guest_last_name, _req.guest_email, _req.guest_phone,
    true, _req.requested_by_user_id, 'non_member', coalesce(_amount_cents, 0), 'paid'
  ) RETURNING id INTO _ticket_id;

  UPDATE public.event_guest_requests
    SET status = 'approved', decided_by = auth.uid(), decided_at = now(),
        ticket_id = _ticket_id, updated_at = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object('ok', true, 'ticket_id', _ticket_id,
    'guest_email', _req.guest_email, 'requester_email', _req.requester_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_event_guest_request(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_event_guest_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.event_guest_requests
    SET status = 'declined', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  WHERE id = _request_id AND status = 'pending';
  RETURN jsonb_build_object('ok', FOUND);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decline_event_guest_request(uuid) TO authenticated;

-- 9. Staff: release a seat to someone on the waitlist
CREATE OR REPLACE FUNCTION public.offer_event_waitlist_seat(_waitlist_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.event_waitlist%ROWTYPE;
  _event public.events%ROWTYPE;
  _sold int;
  _ticket_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _row FROM public.event_waitlist WHERE id = _waitlist_id;
  IF _row.id IS NULL OR _row.status <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting');
  END IF;

  SELECT * INTO _event FROM public.events WHERE id = _row.event_id;

  PERFORM pg_advisory_xact_lock(hashtext(_event.id::text));
  SELECT count(*)::int INTO _sold FROM public.event_tickets t
  WHERE t.event_id = _event.id
    AND (t.status = 'paid' OR (t.status = 'pending' AND t.created_at > now() - interval '15 minutes'));
  IF coalesce(_sold,0) >= _event.capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.event_tickets (
    event_id, user_id, buyer_email, buyer_first_name, buyer_last_name, buyer_phone,
    ticket_type, amount_cents, status
  ) VALUES (
    _event.id, _row.user_id, lower(_row.email), _row.first_name, _row.last_name, _row.phone,
    'member', 0, 'paid'
  ) RETURNING id INTO _ticket_id;

  UPDATE public.event_waitlist
    SET status = 'converted', notified_at = now(), updated_at = now()
  WHERE id = _waitlist_id;

  RETURN jsonb_build_object('ok', true, 'ticket_id', _ticket_id, 'email', _row.email,
    'first_name', _row.first_name);
END;
$$;
GRANT EXECUTE ON FUNCTION public.offer_event_waitlist_seat(uuid) TO authenticated;
