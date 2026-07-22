-- Restore table-level grants (were missing, blocking the public schedule)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;

-- Grant anon SELECT only on public-safe columns (excludes email, phone, pay rates, user_id, login timestamps, portal_enabled, is_public_pt)
GRANT SELECT
  (id, first_name, last_name, bio, photo_url, specialties,
   is_active, is_master, created_at, updated_at)
  ON public.instructors TO anon;

-- Allow anon to read active instructors (RLS still enforced; only granted columns are visible)
DROP POLICY IF EXISTS "Public can view active instructors (safe cols)" ON public.instructors;
CREATE POLICY "Public can view active instructors (safe cols)"
  ON public.instructors
  FOR SELECT
  TO anon
  USING (is_active = true);