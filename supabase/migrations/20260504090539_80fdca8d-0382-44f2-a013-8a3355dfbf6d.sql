ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media_count int NOT NULL DEFAULT 0;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sms-media', 'sms-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read sms-media" ON storage.objects;
CREATE POLICY "Public read sms-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'sms-media');

DROP POLICY IF EXISTS "Staff upload sms-media" ON storage.objects;
CREATE POLICY "Staff upload sms-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sms-media'
  AND public.has_any_role(
    auth.uid(),
    ARRAY['admin','super_admin','manager','front_desk']::app_role[]
  )
);

DROP POLICY IF EXISTS "Staff delete sms-media" ON storage.objects;
CREATE POLICY "Staff delete sms-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sms-media'
  AND public.has_any_role(
    auth.uid(),
    ARRAY['admin','super_admin','manager','front_desk']::app_role[]
  )
);