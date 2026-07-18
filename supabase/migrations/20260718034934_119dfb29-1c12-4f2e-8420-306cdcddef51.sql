
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue text,
  capacity int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  member_price_cents int NOT NULL DEFAULT 0,
  non_member_price_cents int NOT NULL DEFAULT 0,
  member_stripe_price_id text,
  non_member_stripe_price_id text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_status_check CHECK (status IN ('draft','on_sale','sold_out','closed','cancelled'))
);

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-draft events"
  ON public.events FOR SELECT
  USING (status <> 'draft');

CREATE POLICY "Staff can view all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins manage events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email text NOT NULL,
  buyer_first_name text,
  buyer_last_name text,
  buyer_phone text,
  ticket_type text NOT NULL,
  amount_cents int NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_tickets_type_check CHECK (ticket_type IN ('member','non_member')),
  CONSTRAINT event_tickets_status_check CHECK (status IN ('pending','paid','refunded','cancelled'))
);

CREATE INDEX event_tickets_event_id_idx ON public.event_tickets(event_id);
CREATE INDEX event_tickets_user_id_idx ON public.event_tickets(user_id);
CREATE INDEX event_tickets_email_idx ON public.event_tickets(lower(buyer_email));

GRANT SELECT, UPDATE ON public.event_tickets TO authenticated;
GRANT ALL ON public.event_tickets TO service_role;

ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.event_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR lower(buyer_email) = public.current_user_email_lower());

CREATE POLICY "Admins view all tickets"
  ON public.event_tickets FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins update tickets"
  ON public.event_tickets FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER event_tickets_updated_at BEFORE UPDATE ON public.event_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_event_availability(_slug text)
RETURNS TABLE(capacity int, sold int, remaining int, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _capacity int;
  _status text;
  _sold int;
BEGIN
  SELECT id, events.capacity, events.status
    INTO _event_id, _capacity, _status
  FROM public.events WHERE slug = _slug;

  IF _event_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO _sold
  FROM public.event_tickets
  WHERE event_id = _event_id
    AND (
      status = 'paid'
      OR (status = 'pending' AND created_at > now() - interval '15 minutes')
    );

  capacity := _capacity;
  sold := COALESCE(_sold, 0);
  remaining := GREATEST(_capacity - COALESCE(_sold, 0), 0);
  status := _status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_availability(text) TO anon, authenticated;

INSERT INTO public.events (
  slug, title, description, starts_at, venue, capacity, status,
  member_price_cents, non_member_price_cents,
  member_stripe_price_id, non_member_stripe_price_id
) VALUES (
  'sound-bath-jul-25-2026',
  'Sound Bath at Storm Wellness Club',
  'An immersive evening of vibrational sound healing at Storm Wellness Club. Bring a mat, blanket, and pillow — we''ll take care of the rest.',
  '2026-07-25 19:00:00-04',
  'Storm Wellness Club',
  32,
  'on_sale',
  3000,
  4000,
  'price_1TuPC1LyZrsSqLhs660RypmE',
  'price_1TuPEYLyZrsSqLhs1Gwz31Ge'
) ON CONFLICT (slug) DO UPDATE SET
  member_stripe_price_id = EXCLUDED.member_stripe_price_id,
  non_member_stripe_price_id = EXCLUDED.non_member_stripe_price_id,
  capacity = EXCLUDED.capacity,
  starts_at = EXCLUDED.starts_at,
  status = EXCLUDED.status;
