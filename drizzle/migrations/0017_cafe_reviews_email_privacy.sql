-- Ensure raw cafe_reviews rows (which contain reviewer_email) are never readable by visitors.
REVOKE SELECT ON public.cafe_reviews FROM anon, authenticated;

-- Remove the stale table-level public read policy; public reads go through the safe views.
DROP POLICY IF EXISTS "Public can read approved cafe reviews" ON public.cafe_reviews;

-- Public views expose only safe columns of approved reviews; run them with owner rights
-- so they keep working without granting table-wide access to the raw review rows.
ALTER VIEW public.cafe_reviews_public SET (security_invoker = off);
ALTER VIEW public.cafe_item_rating_summary SET (security_invoker = off);

GRANT SELECT ON public.cafe_reviews_public TO anon, authenticated;
GRANT SELECT ON public.cafe_item_rating_summary TO anon, authenticated;