-- Ritual collections (admin-managed, not hard-coded)
CREATE TABLE public.ritual_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  expectation text,
  image_url text,
  eligibility_note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ritual_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritual_collections TO authenticated;
GRANT ALL ON public.ritual_collections TO service_role;

ALTER TABLE public.ritual_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active collections"
ON public.ritual_collections FOR SELECT
USING (is_active = true AND archived_at IS NULL);

CREATE POLICY "Staff manage collections"
ON public.ritual_collections FOR ALL TO authenticated
USING (public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[]));

-- Additive event columns
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.ritual_collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_ritual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS facilitator text,
  ADD COLUMN IF NOT EXISTS eligibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS eligible_tiers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS early_access_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS general_access_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

CREATE INDEX IF NOT EXISTS idx_events_collection ON public.events(collection_id);
CREATE INDEX IF NOT EXISTS idx_events_ritual_starts ON public.events(is_ritual, starts_at);

-- Seed the initial collections
INSERT INTO public.ritual_collections (slug, name, tagline, description, expectation, sort_order)
VALUES
  ('storm-book-society', 'The Storm Book Society', 'Curated reading, unhurried conversation',
   'A season of carefully chosen books and guided conversations among members, held in the quiet of the club.',
   'An intimate circle, a glass of something warm, and a conversation guided by a member host.', 1),
  ('cinema-at-storm', 'Cinema at Storm', 'Members-only screenings, thoughtfully chosen',
   'Film evenings selected for beauty, craft and conversation — screened privately for members.',
   'A private screening, comfortable seating, and a short conversation afterwards for those who linger.', 2),
  ('womens-salon', 'The Women''s Salon', 'Conversations with remarkable women',
   'Intimate conversations with accomplished women — founders, professionals, artists and community voices.',
   'A seated conversation, space for questions, and time to meet the women beside you.', 3),
  ('womens-health-edit', 'The Women''s Health Edit', 'A curated education series',
   'A series exploring individual women''s health topics with qualified professionals, one subject at a time.',
   'A focused session with a qualified guest, clear guidance, and an open question period.', 4),
  ('the-art-of-rest', 'The Art of Rest', 'Restoration, deliberately slow',
   'Restorative experiences built around slowing down, lowering stimulation and creating intentional rest.',
   'Low light, quiet sound, and guided rest. Nothing is asked of you.', 5),
  ('storm-supper-club', 'The Storm Supper Club', 'A limited table, a long evening',
   'Limited-seat dining and conversation experiences held at the club for a small number of members.',
   'A single long table, a considered menu, and conversation that unfolds slowly.', 6),
  ('seasonal-rituals', 'Seasonal & Special Rituals', 'Marking the turning of the year',
   'Full-moon circles, seasonal resets, cultural gatherings and other limited experiences.',
   'Ceremony, stillness and community — held only a few times each year.', 7)
ON CONFLICT (slug) DO NOTHING;

-- Refresh visibility rules on events
DROP POLICY IF EXISTS "Public can view non-draft events" ON public.events;

CREATE POLICY "Public can view publicly visible events"
ON public.events FOR SELECT
USING (status <> 'draft' AND coalesce(visibility, 'public') = 'public');

CREATE POLICY "Signed in members can view member visible events"
ON public.events FOR SELECT TO authenticated
USING (
  status <> 'draft'
  AND coalesce(visibility, 'public') IN ('public', 'members', 'eligible_only')
);

CREATE POLICY "Invited guests can view invitation events"
ON public.events FOR SELECT TO authenticated
USING (
  status <> 'draft'
  AND coalesce(visibility, 'public') = 'invitation'
  AND EXISTS (
    SELECT 1 FROM public.event_tickets t
    WHERE t.event_id = events.id AND t.user_id = (SELECT auth.uid())
  )
);

-- Eligibility helper: returns whether a member record satisfies an event's eligibility rule
CREATE OR REPLACE FUNCTION public.member_meets_event_eligibility(_member public.members, _eligibility text, _eligible_tiers text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _tier text := lower(coalesce(_member.membership_type, ''));
  _founding boolean := coalesce(_member.is_founding_member, false);
  _diamond boolean := _tier LIKE 'diamond%';
BEGIN
  RETURN CASE coalesce(_eligibility, 'public')
    WHEN 'public' THEN true
    WHEN 'all_members' THEN true
    WHEN 'founding_only' THEN _founding
    WHEN 'diamond_only' THEN _diamond
    WHEN 'diamond_founding' THEN (_diamond OR _founding)
    WHEN 'selected_tiers' THEN EXISTS (
      SELECT 1 FROM unnest(coalesce(_eligible_tiers, '{}'::text[])) t
      WHERE lower(t) = _tier
    )
    WHEN 'invitation_only' THEN false
    ELSE true
  END;
END;
$$;

-- Extended member state: adds eligibility + booking-window information
DROP FUNCTION IF EXISTS public.get_event_member_state(text);

CREATE FUNCTION public.get_event_member_state(_slug text)
RETURNS TABLE(
  is_member boolean,
  has_reservation boolean,
  is_waitlisted boolean,
  is_full boolean,
  is_eligible boolean,
  booking_open boolean,
  early_access_only boolean,
  has_priority boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(public.current_user_email(), ''));
  _event public.events%ROWTYPE;
  _member public.members%ROWTYPE;
  _sold int;
BEGIN
  SELECT * INTO _event FROM public.events WHERE slug = _slug;
  IF _event.id IS NULL THEN RETURN; END IF;

  SELECT * INTO _member FROM public.members m
  WHERE m.status IN ('active','frozen')
    AND ((_uid IS NOT NULL AND m.user_id = _uid) OR (_email <> '' AND lower(m.email) = _email))
  LIMIT 1;

  is_member := _member.id IS NOT NULL;

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

  is_eligible := is_member AND public.member_meets_event_eligibility(_member, _event.eligibility, _event.eligible_tiers);

  has_priority := is_member AND (coalesce(_member.is_founding_member,false) OR lower(coalesce(_member.membership_type,'')) LIKE 'diamond%');

  IF _event.general_access_starts_at IS NULL THEN
    booking_open := true;
    early_access_only := false;
  ELSIF now() >= _event.general_access_starts_at THEN
    booking_open := true;
    early_access_only := false;
  ELSIF _event.early_access_starts_at IS NOT NULL AND now() >= _event.early_access_starts_at AND has_priority THEN
    booking_open := true;
    early_access_only := true;
  ELSE
    booking_open := false;
    early_access_only := true;
  END IF;

  RETURN NEXT;
END;
$$;

-- Reservation now verifies tier eligibility and the booking window
CREATE OR REPLACE FUNCTION public.reserve_event_seat(_slug text, _phone text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.events%ROWTYPE;
  _member public.members%ROWTYPE;
  _sold int;
  _ticket_id uuid;
  _priority boolean;
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

  IF NOT public.member_meets_event_eligibility(_member, _event.eligibility, _event.eligible_tiers) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  _priority := coalesce(_member.is_founding_member,false)
    OR lower(coalesce(_member.membership_type,'')) LIKE 'diamond%';

  IF _event.general_access_starts_at IS NOT NULL AND now() < _event.general_access_starts_at THEN
    IF NOT (_event.early_access_starts_at IS NOT NULL
            AND now() >= _event.early_access_starts_at
            AND _priority) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_open');
    END IF;
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
