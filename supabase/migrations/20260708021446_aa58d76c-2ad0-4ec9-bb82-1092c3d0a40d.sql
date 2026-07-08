
-- 1. cafe_reviews table
CREATE TABLE public.cafe_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.cafe_menu_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.cafe_orders(id) ON DELETE SET NULL,
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_display_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  comment TEXT,
  photo_path TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved','hidden','spam','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cafe_reviews_menu_item ON public.cafe_reviews(menu_item_id) WHERE moderation_status = 'approved';
CREATE INDEX idx_cafe_reviews_user ON public.cafe_reviews(reviewer_user_id);
CREATE INDEX idx_cafe_reviews_order ON public.cafe_reviews(order_id);
CREATE INDEX idx_cafe_reviews_created ON public.cafe_reviews(created_at DESC);

-- Prevent duplicate reviews from the same user for the same order+item
CREATE UNIQUE INDEX idx_cafe_reviews_no_dup_per_order_item
  ON public.cafe_reviews(reviewer_user_id, order_id, menu_item_id)
  WHERE reviewer_user_id IS NOT NULL AND order_id IS NOT NULL;

-- Enforce guest name presence and sanitize with a trigger
CREATE OR REPLACE FUNCTION public.cafe_reviews_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.reviewer_display_name := NULLIF(TRIM(NEW.reviewer_display_name), '');
  IF NEW.reviewer_display_name IS NULL THEN
    RAISE EXCEPTION 'A display name is required to submit a café review.';
  END IF;
  IF LENGTH(NEW.reviewer_display_name) > 60 THEN
    NEW.reviewer_display_name := LEFT(NEW.reviewer_display_name, 60);
  END IF;
  IF NEW.comment IS NOT NULL AND LENGTH(NEW.comment) > 1000 THEN
    NEW.comment := LEFT(NEW.comment, 1000);
  END IF;
  IF NEW.tags IS NULL THEN
    NEW.tags := '{}'::TEXT[];
  END IF;
  IF array_length(NEW.tags, 1) > 8 THEN
    NEW.tags := NEW.tags[1:8];
  END IF;
  NEW.is_verified_purchase := NEW.order_id IS NOT NULL;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cafe_reviews_before_write
BEFORE INSERT OR UPDATE ON public.cafe_reviews
FOR EACH ROW EXECUTE FUNCTION public.cafe_reviews_before_write();

-- Table grants
GRANT SELECT, INSERT ON public.cafe_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_reviews TO authenticated;
GRANT ALL ON public.cafe_reviews TO service_role;

-- Enable RLS
ALTER TABLE public.cafe_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read approved reviews only
CREATE POLICY "Public can read approved reviews"
  ON public.cafe_reviews
  FOR SELECT
  USING (moderation_status = 'approved');

-- Staff can read all reviews (any status)
CREATE POLICY "Staff can read all cafe reviews"
  ON public.cafe_reviews
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

-- Anyone (incl. guests/anon) can submit a review
CREATE POLICY "Anyone can submit a cafe review"
  ON public.cafe_reviews
  FOR INSERT
  WITH CHECK (
    -- Signed-in users must own the row
    (auth.uid() IS NULL AND reviewer_user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND reviewer_user_id = auth.uid())
  );

-- Users can update their own review
CREATE POLICY "Users can update own cafe review"
  ON public.cafe_reviews
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND reviewer_user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND reviewer_user_id = auth.uid());

-- Users can delete their own review
CREATE POLICY "Users can delete own cafe review"
  ON public.cafe_reviews
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND reviewer_user_id = auth.uid());

-- Staff can moderate (update/delete any)
CREATE POLICY "Staff can moderate cafe reviews"
  ON public.cafe_reviews
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

-- 2. Public aggregate view for menu-card badges
CREATE OR REPLACE VIEW public.cafe_item_rating_summary
WITH (security_invoker=on) AS
  SELECT
    menu_item_id,
    ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
    COUNT(*)::int AS review_count
  FROM public.cafe_reviews
  WHERE moderation_status = 'approved'
  GROUP BY menu_item_id;

GRANT SELECT ON public.cafe_item_rating_summary TO anon, authenticated;

-- 3. Public display-safe review view (hides email)
CREATE OR REPLACE VIEW public.cafe_reviews_public
WITH (security_invoker=on) AS
  SELECT
    id,
    menu_item_id,
    reviewer_display_name,
    rating,
    tags,
    comment,
    photo_path,
    is_verified_purchase,
    created_at
  FROM public.cafe_reviews
  WHERE moderation_status = 'approved';

GRANT SELECT ON public.cafe_reviews_public TO anon, authenticated;

-- 4. Storage RLS for cafe-review-photos bucket (private bucket, signed URLs)
CREATE POLICY "Anyone can view cafe review photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'cafe-review-photos');

CREATE POLICY "Anyone can upload cafe review photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'cafe-review-photos');

CREATE POLICY "Uploader or staff can update cafe review photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'cafe-review-photos' AND (
      auth.uid() = owner
      OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
    )
  );

CREATE POLICY "Uploader or staff can delete cafe review photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'cafe-review-photos' AND (
      auth.uid() = owner
      OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
    )
  );
