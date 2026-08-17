-- Instructor email/phone/pay rates were readable by any signed-in user because a
-- table-wide SELECT grant overrides the safe-column grants. Replace it with an
-- explicit safe-column grant, mirroring public.spa_therapists.
REVOKE SELECT ON public.instructors FROM authenticated;

GRANT SELECT (
  id,
  user_id,
  first_name,
  last_name,
  bio,
  photo_url,
  specialties,
  is_active,
  is_master,
  is_public_pt,
  employment_status,
  schedule_color,
  can_self_book,
  can_edit_others_appointments,
  default_location_id,
  portal_enabled,
  created_at,
  updated_at
) ON public.instructors TO authenticated;