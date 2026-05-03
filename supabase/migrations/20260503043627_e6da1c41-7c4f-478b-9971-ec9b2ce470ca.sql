
-- ============ cafe_orders: remove anonymous insert ============
DROP POLICY IF EXISTS "Users can create their own orders" ON public.cafe_orders;
CREATE POLICY "Users can create their own orders"
ON public.cafe_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============ card_setup_attempts: restrict to staff (service role bypasses RLS) ============
DROP POLICY IF EXISTS "System can insert card setup attempts" ON public.card_setup_attempts;
DROP POLICY IF EXISTS "System can update card setup attempts" ON public.card_setup_attempts;

CREATE POLICY "Staff can insert card setup attempts"
ON public.card_setup_attempts
FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Staff can update card setup attempts"
ON public.card_setup_attempts
FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- ============ class_sessions: hide hidden/cancelled from members and public ============
DROP POLICY IF EXISTS "Authenticated users can view class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Public can view upcoming class sessions" ON public.class_sessions;

CREATE POLICY "Authenticated users can view visible class sessions"
ON public.class_sessions
FOR SELECT
TO authenticated
USING (
  COALESCE(is_hidden, false) = false
  AND COALESCE(is_cancelled, false) = false
);

CREATE POLICY "Public can view upcoming visible class sessions"
ON public.class_sessions
FOR SELECT
TO anon
USING (
  session_date >= CURRENT_DATE
  AND COALESCE(is_hidden, false) = false
  AND COALESCE(is_cancelled, false) = false
);

-- ============ instructors: revoke email/phone columns from non-staff ============
-- Keep the existing row-level policies (they already restrict to authenticated + active),
-- but use column-level privileges so anon/authenticated cannot select email/phone.
REVOKE ALL ON public.instructors FROM anon, authenticated;
GRANT SELECT (id, user_id, first_name, last_name, bio, photo_url, specialties, is_active, created_at, updated_at)
  ON public.instructors TO anon, authenticated;
-- Staff queries run via has_any_role policy; grant full select to authenticated for staff.
-- Postgres column grants are additive at the role level; staff members are still in 'authenticated',
-- and we cannot grant per-app_role. So instead, expose email/phone through a security-definer RPC if needed.
-- Admin UI (useTeamMembers, Instructors page) already uses service-role-equivalent staff access; we
-- ensure those can still read by granting full select to service_role explicitly.
GRANT ALL ON public.instructors TO service_role;

-- Provide a security-definer RPC for staff to read full instructor records (incl. email/phone)
CREATE OR REPLACE FUNCTION public.get_instructors_with_contact()
RETURNS SETOF public.instructors
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.instructors
  WHERE has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]);
$$;
REVOKE ALL ON FUNCTION public.get_instructors_with_contact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instructors_with_contact() TO authenticated;

-- ============ spa_therapists: same column-level approach ============
DROP POLICY IF EXISTS "Anyone can view spa therapists" ON public.spa_therapists;
CREATE POLICY "Authenticated can view active spa therapists"
ON public.spa_therapists
FOR SELECT
TO authenticated
USING (is_active = true);
CREATE POLICY "Public can view active spa therapists basic info"
ON public.spa_therapists
FOR SELECT
TO anon
USING (is_active = true);

REVOKE ALL ON public.spa_therapists FROM anon, authenticated;
GRANT SELECT (id, full_name, bio, specialties, photo_url, is_active, created_at, updated_at)
  ON public.spa_therapists TO anon, authenticated;
GRANT ALL ON public.spa_therapists TO service_role;

CREATE OR REPLACE FUNCTION public.get_spa_therapists_with_contact()
RETURNS SETOF public.spa_therapists
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.spa_therapists
  WHERE has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]);
$$;
REVOKE ALL ON FUNCTION public.get_spa_therapists_with_contact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_spa_therapists_with_contact() TO authenticated;

-- ============ Storage: cafe-menu-images — staff-only writes ============
DROP POLICY IF EXISTS "Staff can upload cafe menu images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update cafe menu images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete cafe menu images" ON storage.objects;

CREATE POLICY "Staff can upload cafe menu images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cafe-menu-images'
  AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
);

CREATE POLICY "Staff can update cafe menu images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cafe-menu-images'
  AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
);

CREATE POLICY "Staff can delete cafe menu images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cafe-menu-images'
  AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
);

-- ============ Storage: member-photos — restrict view to authenticated ============
DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;
CREATE POLICY "Authenticated can view member photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'member-photos');

-- ============ merch_orders: bind ownership when authenticated ============
DROP POLICY IF EXISTS "Anyone can create merch orders" ON public.merch_orders;
CREATE POLICY "Anyone can create merch orders"
ON public.merch_orders
FOR INSERT
TO public
WITH CHECK (
  -- If authenticated, user_id must match the caller
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NOT NULL AND user_id IS NULL)
);
