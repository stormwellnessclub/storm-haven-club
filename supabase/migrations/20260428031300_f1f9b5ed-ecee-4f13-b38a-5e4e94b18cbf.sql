CREATE OR REPLACE FUNCTION public.get_class_reviews_with_names(_class_type_id UUID)
  RETURNS TABLE(
    id UUID,
    rating INTEGER,
    review_text TEXT,
    is_visible BOOLEAN,
    created_at TIMESTAMPTZ,
    reviewer_name TEXT
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT cr.id, cr.user_id, cr.rating, cr.review_text, cr.is_visible, cr.created_at
    FROM public.class_reviews cr
    WHERE cr.class_type_id = _class_type_id
      AND cr.is_visible = true
  ),
  resolved AS (
    SELECT
      b.id,
      b.rating,
      b.review_text,
      b.is_visible,
      b.created_at,
      COALESCE(
        m.first_name,
        p.first_name,
        nm.first_name
      ) AS first_name,
      COALESCE(
        m.last_name,
        p.last_name,
        nm.last_name
      ) AS last_name
    FROM base b
    LEFT JOIN public.members m ON m.user_id = b.user_id
    LEFT JOIN public.profiles p ON p.id = b.user_id
    LEFT JOIN public.non_member_profiles nm ON nm.user_id = b.user_id
  )
  SELECT
    id,
    rating,
    review_text,
    is_visible,
    created_at,
    CASE
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' AND COALESCE(NULLIF(TRIM(last_name), ''), '') = '' THEN 'Member'
      WHEN COALESCE(NULLIF(TRIM(last_name), ''), '') = '' THEN TRIM(first_name)
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' THEN TRIM(last_name)
      ELSE TRIM(first_name) || ' ' || UPPER(LEFT(TRIM(last_name), 1)) || '.'
    END AS reviewer_name
  FROM resolved
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_reviews_with_names(UUID) TO anon, authenticated;