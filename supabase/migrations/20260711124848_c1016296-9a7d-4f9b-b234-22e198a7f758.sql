-- 1) Fix SECURITY DEFINER view: switch gut_reset_sessions_public to security_invoker
ALTER VIEW public.gut_reset_sessions_public SET (security_invoker = on);

-- 2) Remove public exposure of cafe_reviews (including reviewer_email). Public reads go through cafe_reviews_public view.
DROP POLICY IF EXISTS "Public can read approved reviews" ON public.cafe_reviews;
REVOKE SELECT ON public.cafe_reviews FROM anon;

-- 3) Restrict kids_care_hour_slots so anon cannot read staff_name/notes.
DROP POLICY IF EXISTS "Public can view kids care hour slots" ON public.kids_care_hour_slots;
REVOKE SELECT ON public.kids_care_hour_slots FROM anon;

-- Provide a safe public view exposing only operational hours (no staff_name/notes).
CREATE OR REPLACE VIEW public.kids_care_hour_slots_public
WITH (security_invoker = on) AS
SELECT id, slot_date, open_time, close_time, label
FROM public.kids_care_hour_slots;

GRANT SELECT ON public.kids_care_hour_slots_public TO anon, authenticated;