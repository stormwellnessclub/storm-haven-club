
-- class_reviews table
CREATE TABLE public.class_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.class_bookings(id) ON DELETE CASCADE,
  class_type_id UUID NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  review_text TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One review per booking
CREATE UNIQUE INDEX idx_class_reviews_booking ON public.class_reviews(booking_id);

-- For aggregation queries
CREATE INDEX idx_class_reviews_class_type ON public.class_reviews(class_type_id) WHERE is_visible = true;

-- Rating validation trigger (1-5)
CREATE OR REPLACE FUNCTION public.validate_class_review_rating()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_class_review_rating
  BEFORE INSERT OR UPDATE ON public.class_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_class_review_rating();

-- Aggregate ratings function
CREATE OR REPLACE FUNCTION public.get_class_type_ratings(_class_type_id UUID)
  RETURNS TABLE(average_rating NUMERIC, review_count BIGINT)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    ROUND(AVG(rating)::NUMERIC, 1) AS average_rating,
    COUNT(*) AS review_count
  FROM public.class_reviews
  WHERE class_type_id = _class_type_id AND is_visible = true;
$$;

-- Batch ratings for multiple class types
CREATE OR REPLACE FUNCTION public.get_all_class_type_ratings()
  RETURNS TABLE(class_type_id UUID, average_rating NUMERIC, review_count BIGINT)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    cr.class_type_id,
    ROUND(AVG(cr.rating)::NUMERIC, 1) AS average_rating,
    COUNT(*) AS review_count
  FROM public.class_reviews cr
  WHERE cr.is_visible = true
  GROUP BY cr.class_type_id;
$$;

-- RLS
ALTER TABLE public.class_reviews ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read visible reviews
CREATE POLICY "Anyone can read visible reviews"
  ON public.class_reviews FOR SELECT
  TO authenticated
  USING (is_visible = true);

-- Anon can also read visible reviews (public schedule)
CREATE POLICY "Anon can read visible reviews"
  ON public.class_reviews FOR SELECT
  TO anon
  USING (is_visible = true);

-- Users can insert reviews for their own bookings on past sessions
CREATE POLICY "Users can review their own past bookings"
  ON public.class_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.class_bookings cb
      JOIN public.class_sessions cs ON cs.id = cb.session_id
      WHERE cb.id = booking_id
        AND cb.user_id = auth.uid()
        AND cb.status IN ('confirmed', 'completed')
        AND cs.session_date < CURRENT_DATE
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON public.class_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff can manage all reviews
CREATE POLICY "Staff can manage all reviews"
  ON public.class_reviews FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
