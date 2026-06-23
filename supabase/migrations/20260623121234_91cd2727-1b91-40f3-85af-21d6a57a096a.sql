-- Re-add broad SELECT on instructors so embedded joins (instructor:instructors) work for members
-- viewing the class schedule. Sensitive columns (email, phone) are protected by explicit column-level
-- REVOKE so only staff (via the separate staff policy + column grants) can read them.
DROP POLICY IF EXISTS "Authenticated can view active instructors" ON public.instructors;
CREATE POLICY "Authenticated can view active instructors"
ON public.instructors
FOR SELECT
TO authenticated
USING (is_active = true);

-- Defense-in-depth: explicitly REVOKE access to sensitive columns from anon/authenticated.
REVOKE SELECT (email, phone) ON public.instructors FROM anon, authenticated;
REVOKE SELECT (email, phone, hourly_rate) ON public.spa_therapists FROM anon, authenticated;

-- Re-grant safe columns on instructors (idempotent — these may already exist).
GRANT SELECT (id, first_name, last_name, bio, specialties, photo_url, is_active, created_at, updated_at) ON public.instructors TO anon, authenticated;
GRANT SELECT (user_id) ON public.instructors TO authenticated;