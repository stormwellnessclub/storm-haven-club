DROP POLICY IF EXISTS "Anyone can read event images" ON storage.objects;

CREATE POLICY "Staff can read event images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-images'
  AND has_any_role((SELECT auth.uid()), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role])
);