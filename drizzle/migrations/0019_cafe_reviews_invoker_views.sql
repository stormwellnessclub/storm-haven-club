-- Fix SUPA_security_definer_view: make the two public cafe views run with the
-- querying user's rights, while keeping reviewer emails unreadable via
-- column-level grants + an approved-rows-only RLS policy.

ALTER VIEW public.cafe_reviews_public SET (security_invoker = on);
ALTER VIEW public.cafe_item_rating_summary SET (security_invoker = on);

-- Approved reviews are public content.
DROP POLICY IF EXISTS "Public can read approved cafe reviews" ON public.cafe_reviews;
CREATE POLICY "Public can read approved cafe reviews"
ON public.cafe_reviews
FOR SELECT
TO anon, authenticated
USING (moderation_status = 'approved');

-- Only non-sensitive columns are readable directly; reviewer_email and
-- reviewer_user_id are deliberately excluded.
REVOKE SELECT ON public.cafe_reviews FROM anon, authenticated;
GRANT SELECT (
  id,
  menu_item_id,
  reviewer_display_name,
  rating,
  tags,
  comment,
  photo_path,
  is_verified_purchase,
  created_at,
  moderation_status
) ON public.cafe_reviews TO anon, authenticated;

GRANT SELECT ON public.cafe_reviews_public TO anon, authenticated;
GRANT SELECT ON public.cafe_item_rating_summary TO anon, authenticated;
GRANT ALL ON public.cafe_reviews TO service_role;
