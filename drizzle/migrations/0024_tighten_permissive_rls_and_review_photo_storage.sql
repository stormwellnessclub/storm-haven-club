-- 1. merch_inventory: only stock for active products is publicly readable
DROP POLICY IF EXISTS "Public can view merch inventory" ON public.merch_inventory;
CREATE POLICY "Public can view active merch inventory"
ON public.merch_inventory FOR SELECT
USING (EXISTS (SELECT 1 FROM public.merch_products p WHERE p.id = merch_inventory.product_id AND p.is_active));

-- 2. spa catalog tables: only active rows are public; staff keep full access via existing manage policies
DROP POLICY IF EXISTS "Anyone can view spa services" ON public.spa_services;
CREATE POLICY "Anyone can view active spa services"
ON public.spa_services FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Anyone can view spa rooms" ON public.spa_rooms;
CREATE POLICY "Anyone can view active spa rooms"
ON public.spa_rooms FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Anyone can view spa addons" ON public.spa_service_addons;
CREATE POLICY "Anyone can view active spa addons"
ON public.spa_service_addons FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Anyone can view service availability" ON public.spa_service_availability;
CREATE POLICY "Anyone can view active service availability"
ON public.spa_service_availability FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Anyone can view therapist services" ON public.spa_therapist_services;
CREATE POLICY "Anyone can view active therapist services"
ON public.spa_therapist_services FOR SELECT
USING (EXISTS (SELECT 1 FROM public.spa_therapists t WHERE t.id = spa_therapist_services.therapist_id AND t.is_active));

-- 3. cafe ordering settings: only the single settings row is readable
DROP POLICY IF EXISTS "Anyone can read cafe ordering settings" ON public.cafe_ordering_settings;
CREATE POLICY "Anyone can read the cafe ordering toggle"
ON public.cafe_ordering_settings FOR SELECT USING (id = true);

-- 4. kids care hours: members only see current and upcoming weeks
DROP POLICY IF EXISTS "Members can read kids care hours" ON public.kids_care_hours;
CREATE POLICY "Members can read current kids care hours"
ON public.kids_care_hours FOR SELECT TO authenticated
USING (week_start >= ((now() AT TIME ZONE 'America/Detroit')::date - INTERVAL '14 days'));

-- 5. PT reference tables: signed-in users only see active entries; staff manage policies unchanged
DROP POLICY IF EXISTS "read pt locations" ON public.pt_locations;
CREATE POLICY "read active pt locations"
ON public.pt_locations FOR SELECT TO authenticated USING (is_active);

DROP POLICY IF EXISTS "read pt session types" ON public.pt_session_types;
CREATE POLICY "read active pt session types"
ON public.pt_session_types FOR SELECT TO authenticated USING (is_active);

DROP POLICY IF EXISTS "Authenticated read PT exercise library" ON public.pt_exercise_library;
CREATE POLICY "Authenticated read active PT exercise library"
ON public.pt_exercise_library FOR SELECT TO authenticated USING (is_active);

-- 6. private event requests: public submissions must be well-formed and cannot preset staff fields
DROP POLICY IF EXISTS "Anyone can submit a private event request" ON public.private_event_requests;
CREATE POLICY "Anyone can submit a valid private event request"
ON public.private_event_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(btrim(first_name)) BETWEEN 1 AND 80
  AND char_length(btrim(last_name)) BETWEEN 1 AND 80
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND char_length(email) <= 160
  AND coalesce(char_length(phone), 0) <= 40
  AND coalesce(char_length(notes), 0) <= 4000
  AND coalesce(char_length(event_type), 0) <= 80
  AND coalesce(char_length(budget_range), 0) <= 60
  AND (guest_count IS NULL OR (guest_count > 0 AND guest_count <= 2000))
  AND coalesce(array_length(spaces, 1), 0) <= 12
  AND converted_event_id IS NULL
  AND coalesce(status, 'pending') = 'pending'
);

-- 7. cafe review photos: uploads and reads are bound to their owner (approved photos are served through a signed-URL function)
DROP POLICY IF EXISTS "Anyone can upload cafe review photos" ON storage.objects;
CREATE POLICY "Members upload their own cafe review photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cafe-review-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

DROP POLICY IF EXISTS "Approved cafe review photos are viewable" ON storage.objects;
CREATE POLICY "Owners and cafe staff read cafe review photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cafe-review-photos'
  AND (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    OR owner_id = (select auth.uid()::text)
    OR has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role])
  )
);