
-- Create equipment-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for equipment images
CREATE POLICY "Equipment images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'equipment-images');

-- Only admins can upload equipment images
CREATE POLICY "Admins can upload equipment images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'equipment-images' 
  AND public.is_admin(auth.uid())
);

-- Only admins can update equipment images
CREATE POLICY "Admins can update equipment images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'equipment-images' 
  AND public.is_admin(auth.uid())
);

-- Only admins can delete equipment images
CREATE POLICY "Admins can delete equipment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'equipment-images' 
  AND public.is_admin(auth.uid())
);
