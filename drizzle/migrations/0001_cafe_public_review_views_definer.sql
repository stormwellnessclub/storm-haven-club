-- Public cafe review views must not depend on the caller having SELECT on the
-- underlying cafe_reviews table (anon lost that grant), so run them as owner.
ALTER VIEW public.cafe_reviews_public SET (security_invoker = off);
ALTER VIEW public.cafe_item_rating_summary SET (security_invoker = off);

GRANT SELECT ON public.cafe_reviews_public TO anon, authenticated;
GRANT SELECT ON public.cafe_item_rating_summary TO anon, authenticated;