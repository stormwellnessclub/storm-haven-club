-- Signed-in users need these columns to find which of their own order items
-- they already reviewed. reviewer_email remains ungranted for everyone.
GRANT SELECT (order_id, reviewer_user_id) ON public.cafe_reviews TO authenticated;
