CREATE POLICY "Admins upload email images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-images' AND public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE POLICY "Admins read email images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-images' AND public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));