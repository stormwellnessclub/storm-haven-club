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
    EXISTS (SELECT 1 FROM public.class_passes p WHERE p.user_id = _user_id AND p.pass_type <> 'kids_care')
    OR EXISTS (SELECT 1 FROM public.class_bookings b WHERE b.user_id = _user_id OR (v_email <> '' AND lower(b.walk_in_email) = v_email))
  ) THEN RETURN 'The Discovery Pass is for first-time class guests.'; END IF;
  RETURN NULL;
END $$;