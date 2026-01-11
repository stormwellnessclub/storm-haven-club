-- Create member-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('member-photos', 'member-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS: Members can upload their own photos
CREATE POLICY "Members can upload their own photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'member-photos' 
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text FROM public.members m WHERE m.user_id = auth.uid()
  )
);

-- RLS: Members can update their own photos  
CREATE POLICY "Members can update their own photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'member-photos' 
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text FROM public.members m WHERE m.user_id = auth.uid()
  )
);

-- RLS: Members can delete their own photos
CREATE POLICY "Members can delete their own photo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'member-photos' 
  AND (storage.foldername(name))[1] IN (
    SELECT m.id::text FROM public.members m WHERE m.user_id = auth.uid()
  )
);

-- RLS: Anyone can view member photos (public bucket)
CREATE POLICY "Anyone can view member photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'member-photos');

-- Add qr_token_secret to scanner_settings for HMAC signing
ALTER TABLE public.scanner_settings 
ADD COLUMN IF NOT EXISTS qr_token_secret TEXT;

-- Generate a random secret for the front_desk location
UPDATE public.scanner_settings 
SET qr_token_secret = encode(gen_random_bytes(32), 'hex')
WHERE location_name = 'front_desk' AND qr_token_secret IS NULL;

-- Insert default if not exists
INSERT INTO public.scanner_settings (location_name, qr_token_secret, auto_check_in_enabled, audio_feedback_enabled)
VALUES ('front_desk', encode(gen_random_bytes(32), 'hex'), true, true)
ON CONFLICT (location_name) DO UPDATE 
SET qr_token_secret = COALESCE(public.scanner_settings.qr_token_secret, encode(gen_random_bytes(32), 'hex'));