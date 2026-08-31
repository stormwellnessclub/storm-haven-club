create or replace function public.get_public_class_reviews()
returns table (
  id uuid,
  rating integer,
  review_text text,
  created_at timestamptz,
  reviewer_name text,
  class_type_id uuid,
  class_type_name text,
  class_category text,
  instructor_id uuid,
  instructor_name text
)
language sql
stable
security definer
set search_path = public
as $$
  WITH base AS (
    SELECT cr.id, cr.user_id, cr.rating, cr.review_text, cr.created_at,
           cr.class_type_id, cr.session_id
    FROM public.class_reviews cr
    WHERE cr.is_visible = true
  )
  SELECT
    b.id,
    b.rating,
    b.review_text,
    b.created_at,
    CASE
      WHEN COALESCE(NULLIF(TRIM(COALESCE(m.first_name, p.first_name, nm.first_name)), ''), '') = ''
       AND COALESCE(NULLIF(TRIM(COALESCE(m.last_name, p.last_name, nm.last_name)), ''), '') = '' THEN 'Member'
      WHEN COALESCE(NULLIF(TRIM(COALESCE(m.last_name, p.last_name, nm.last_name)), ''), '') = ''
        THEN TRIM(COALESCE(m.first_name, p.first_name, nm.first_name))
      WHEN COALESCE(NULLIF(TRIM(COALESCE(m.first_name, p.first_name, nm.first_name)), ''), '') = ''
        THEN TRIM(COALESCE(m.last_name, p.last_name, nm.last_name))
      ELSE TRIM(COALESCE(m.first_name, p.first_name, nm.first_name)) || ' ' ||
           UPPER(LEFT(TRIM(COALESCE(m.last_name, p.last_name, nm.last_name)), 1)) || '.'
    END AS reviewer_name,
    b.class_type_id,
    ct.name AS class_type_name,
    ct.category::text AS class_category,
    i.id AS instructor_id,
    CASE
      WHEN i.id IS NULL THEN NULL
      ELSE TRIM(COALESCE(i.first_name, '') || ' ' || COALESCE(i.last_name, ''))
    END AS instructor_name
  FROM base b
  LEFT JOIN public.members m ON m.user_id = b.user_id
  LEFT JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.non_member_profiles nm ON nm.user_id = b.user_id
  LEFT JOIN public.class_types ct ON ct.id = b.class_type_id
  LEFT JOIN public.class_sessions cs ON cs.id = b.session_id
  LEFT JOIN public.instructors i ON i.id = cs.instructor_id
  ORDER BY b.created_at DESC;
$$;

grant execute on function public.get_public_class_reviews() to anon, authenticated;