CREATE TABLE IF NOT EXISTS public.seasonal_class_offers (
  key text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  classes integer NOT NULL CHECK (classes > 0),
  expiry_days integer NOT NULL CHECK (expiry_days > 0),
  audience text NOT NULL DEFAULT 'non_member' CHECK (audience IN ('any','non_member')),
  first_time_only boolean NOT NULL DEFAULT false,
  includes_day_pass boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seasonal_class_offers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.seasonal_class_offers TO anon, authenticated;
GRANT UPDATE ON public.seasonal_class_offers TO authenticated;
GRANT ALL ON public.seasonal_class_offers TO service_role;
CREATE POLICY "Anyone can read seasonal class offers" ON public.seasonal_class_offers FOR SELECT USING (true);
CREATE POLICY "Admins manage seasonal class offers" ON public.seasonal_class_offers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

INSERT INTO public.seasonal_class_offers (key,name,price_cents,classes,expiry_days,audience,first_time_only,includes_day_pass,ends_at,display_order) VALUES
 ('discovery_pass','The Discovery Pass',7500,3,21,'any',true,false,'2026-12-01 04:59:59+00',1),
 ('movement_edit','The Movement Edit',25500,10,60,'non_member',false,false,'2026-12-01 04:59:59+00',2),
 ('club_experience','The Club Experience',28500,10,60,'non_member',false,true,'2026-12-01 04:59:59+00',3)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.class_passes ADD COLUMN IF NOT EXISTS seasonal_offer_key text;
ALTER TABLE public.class_passes ADD COLUMN IF NOT EXISTS day_pass_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS class_passes_discovery_once ON public.class_passes (user_id) WHERE seasonal_offer_key = 'discovery_pass';

-- Returns NULL when the person may buy the offer, otherwise a plain-language reason.
CREATE OR REPLACE FUNCTION public.seasonal_class_offer_block_reason(_user_id uuid, _email text, _key text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.seasonal_class_offers; v_email text := lower(trim(coalesce(_email,'')));
BEGIN
  SELECT * INTO o FROM public.seasonal_class_offers WHERE key = _key;
  IF NOT FOUND OR NOT o.is_active THEN RETURN 'This offer is not available right now.'; END IF;
  IF o.starts_at IS NOT NULL AND now() < o.starts_at THEN RETURN 'This offer has not started yet.'; END IF;
  IF o.ends_at IS NOT NULL AND now() > o.ends_at THEN RETURN 'This offer has ended.'; END IF;
  IF o.audience = 'non_member' AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE (m.user_id = _user_id OR (v_email <> '' AND lower(m.email) = v_email))
      AND m.status NOT IN ('cancelled','expired')
  ) THEN RETURN 'This package is for non-members.'; END IF;
  IF o.first_time_only AND (
    EXISTS (SELECT 1 FROM public.class_passes p WHERE p.user_id = _user_id AND p.category <> 'kids_care'::class_category IS NOT FALSE AND p.pass_type <> 'kids_care')
    OR EXISTS (SELECT 1 FROM public.class_bookings b WHERE b.user_id = _user_id OR (v_email <> '' AND lower(b.walk_in_email) = v_email))
  ) THEN RETURN 'The Discovery Pass is for first-time class guests.'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.seasonal_class_offer_block_reason(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seasonal_class_offer_block_reason(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.my_seasonal_class_offer_eligibility()
RETURNS TABLE(key text, reason text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.key, public.seasonal_class_offer_block_reason(auth.uid(), public.current_user_email(), o.key)
  FROM public.seasonal_class_offers o WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.my_seasonal_class_offer_eligibility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_seasonal_class_offer_eligibility() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_seasonal_class_purchases()
RETURNS TABLE(pass_id uuid, offer_key text, user_id uuid, buyer_name text, buyer_email text, purchased_at timestamptz, expires_at timestamptz, classes_total int, classes_remaining int, price_paid numeric, day_pass_id uuid, day_pass_used_at timestamptz, classes_booked bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT p.id, p.seasonal_offer_key, p.user_id,
    nullif(trim(coalesce(pr.first_name,'')||' '||coalesce(pr.last_name,'')),''), pr.email,
    p.purchased_at, p.expires_at, p.classes_total, p.classes_remaining, p.price_paid,
    p.day_pass_id, g.used_at,
    (SELECT count(*) FROM public.class_bookings b WHERE b.pass_id = p.id AND b.status <> 'cancelled')
  FROM public.class_passes p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.guest_passes g ON g.id = p.day_pass_id
  WHERE p.seasonal_offer_key IS NOT NULL
  ORDER BY p.purchased_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_seasonal_class_purchases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_seasonal_class_purchases() TO authenticated;