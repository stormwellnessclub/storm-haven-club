
-- Tighten member-photos: owners or staff only
DROP POLICY IF EXISTS "Authenticated can view member photos" ON storage.objects;

CREATE POLICY "Members or staff can view member photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'member-photos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT (m.id)::text FROM public.members m WHERE m.user_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'super_admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
  )
);

-- Lock down sms-media: bucket is now private; restrict reads to staff.
DROP POLICY IF EXISTS "Public read sms-media" ON storage.objects;

CREATE POLICY "Staff read sms-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'sms-media'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'super_admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
);
