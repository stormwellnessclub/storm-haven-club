CREATE POLICY "Spa providers view sculpt progress photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'spa-progress-photos' AND public.is_spa_provider(auth.uid()));

CREATE POLICY "Spa providers upload consented sculpt progress photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spa-progress-photos' AND public.is_spa_provider(auth.uid()) AND public.sculpt_photo_path_allowed(name));

CREATE POLICY "Spa providers delete sculpt progress photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'spa-progress-photos' AND public.is_spa_provider(auth.uid()));