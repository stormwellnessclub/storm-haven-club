
DROP POLICY IF EXISTS "pt docs read" ON storage.objects;
CREATE POLICY "pt docs read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pt-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.pt_is_desk(auth.uid())
    OR public.pt_can_coach_client(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);

DROP POLICY IF EXISTS "pt docs write" ON storage.objects;
CREATE POLICY "pt docs write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pt-documents'
  AND (
    public.pt_is_desk(auth.uid())
    OR public.pt_can_coach_client(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);

DROP POLICY IF EXISTS "pt docs update" ON storage.objects;
CREATE POLICY "pt docs update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pt-documents' AND public.pt_is_desk(auth.uid()))
WITH CHECK (bucket_id = 'pt-documents' AND public.pt_is_desk(auth.uid()));

DROP POLICY IF EXISTS "pt docs delete" ON storage.objects;
CREATE POLICY "pt docs delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pt-documents' AND public.pt_is_staff(auth.uid()));
