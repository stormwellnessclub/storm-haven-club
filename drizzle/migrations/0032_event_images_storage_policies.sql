CREATE POLICY "Anyone can read event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

CREATE POLICY "Staff can upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])
);

CREATE POLICY "Staff can update event images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-images'
  AND public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])
)
WITH CHECK (
  bucket_id = 'event-images'
  AND public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])
);

CREATE POLICY "Staff can delete event images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-images'
  AND public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])
);