GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_reviews TO authenticated;
GRANT INSERT ON public.cafe_reviews TO anon;
GRANT ALL ON public.cafe_reviews TO service_role;