-- Spa Reviews
CREATE TABLE public.spa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL,
  therapist_id UUID REFERENCES public.spa_therapists(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_spa_reviews_appointment ON public.spa_reviews(appointment_id);
CREATE INDEX idx_spa_reviews_service ON public.spa_reviews(service_id) WHERE is_visible = true;
CREATE INDEX idx_spa_reviews_therapist ON public.spa_reviews(therapist_id) WHERE is_visible = true;
CREATE INDEX idx_spa_reviews_user ON public.spa_reviews(user_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_spa_review_rating()
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

CREATE TRIGGER trg_validate_spa_review_rating
  BEFORE INSERT OR UPDATE ON public.spa_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_spa_review_rating();

-- RLS
ALTER TABLE public.spa_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read visible spa reviews"
  ON public.spa_reviews FOR SELECT TO anon
  USING (is_visible = true);

CREATE POLICY "Authenticated can read visible spa reviews"
  ON public.spa_reviews FOR SELECT TO authenticated
  USING (is_visible = true OR user_id = auth.uid());

CREATE POLICY "Users can review their own completed appointments"
  ON public.spa_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.spa_appointments sa
      WHERE sa.id = appointment_id
        AND sa.user_id = auth.uid()
        AND sa.status = 'completed'
    )
  );

CREATE POLICY "Users can update their own spa reviews"
  ON public.spa_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can manage all spa reviews"
  ON public.spa_reviews FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- Aggregate ratings per service
CREATE OR REPLACE FUNCTION public.get_all_spa_service_ratings()
  RETURNS TABLE(service_id UUID, average_rating NUMERIC, review_count BIGINT)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT sr.service_id,
         ROUND(AVG(sr.rating)::NUMERIC, 1) AS average_rating,
         COUNT(*) AS review_count
  FROM public.spa_reviews sr
  WHERE sr.is_visible = true
  GROUP BY sr.service_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_spa_service_ratings() TO anon, authenticated;

-- Public reviews with abbreviated reviewer name (First L.)
-- _service_id NULL = all services
CREATE OR REPLACE FUNCTION public.get_spa_reviews_with_names(_service_id UUID DEFAULT NULL)
  RETURNS TABLE(
    id UUID,
    rating INTEGER,
    review_text TEXT,
    is_visible BOOLEAN,
    created_at TIMESTAMPTZ,
    service_id UUID,
    service_name TEXT,
    therapist_id UUID,
    therapist_name TEXT,
    reviewer_name TEXT
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT sr.id, sr.user_id, sr.rating, sr.review_text, sr.is_visible, sr.created_at,
           sr.service_id, sr.therapist_id
    FROM public.spa_reviews sr
    WHERE sr.is_visible = true
      AND (_service_id IS NULL OR sr.service_id = _service_id)
  ),
  resolved AS (
    SELECT b.*,
      COALESCE(m.first_name, p.first_name, nm.first_name) AS first_name,
      COALESCE(m.last_name, p.last_name, nm.last_name) AS last_name,
      ss.name AS service_name,
      st.full_name AS therapist_name
    FROM base b
    LEFT JOIN public.members m ON m.user_id = b.user_id
    LEFT JOIN public.profiles p ON p.id = b.user_id
    LEFT JOIN public.non_member_profiles nm ON nm.user_id = b.user_id
    LEFT JOIN public.spa_services ss ON ss.id = b.service_id
    LEFT JOIN public.spa_therapists st ON st.id = b.therapist_id
  )
  SELECT
    id, rating, review_text, is_visible, created_at,
    service_id, service_name, therapist_id, therapist_name,
    CASE
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' AND COALESCE(NULLIF(TRIM(last_name), ''), '') = '' THEN 'Member'
      WHEN COALESCE(NULLIF(TRIM(last_name), ''), '') = '' THEN TRIM(first_name)
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' THEN TRIM(last_name)
      ELSE TRIM(first_name) || ' ' || UPPER(LEFT(TRIM(last_name), 1)) || '.'
    END AS reviewer_name
  FROM resolved
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_spa_reviews_with_names(UUID) TO anon, authenticated;

-- Pending unreviewed completed spa appointments for the current user
CREATE OR REPLACE FUNCTION public.get_pending_spa_reviews()
  RETURNS TABLE(
    appointment_id UUID,
    service_id UUID,
    service_name TEXT,
    therapist_id UUID,
    therapist_name TEXT,
    appointment_date DATE,
    appointment_time TIME,
    completed_at TIMESTAMPTZ
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT sa.id AS appointment_id,
         CASE WHEN sa.service_id ~ '^[0-9a-f-]{36}$' THEN sa.service_id::uuid ELSE NULL END AS service_id,
         sa.service_name,
         sa.staff_id AS therapist_id,
         st.full_name AS therapist_name,
         sa.appointment_date,
         sa.appointment_time,
         sa.completed_at
  FROM public.spa_appointments sa
  LEFT JOIN public.spa_therapists st ON st.id = sa.staff_id
  LEFT JOIN public.spa_reviews sr ON sr.appointment_id = sa.id
  WHERE sa.user_id = auth.uid()
    AND sa.status = 'completed'
    AND sr.id IS NULL
  ORDER BY sa.completed_at DESC NULLS LAST, sa.appointment_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_spa_reviews() TO authenticated;