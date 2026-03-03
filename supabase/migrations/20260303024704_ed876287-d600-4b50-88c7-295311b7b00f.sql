
-- Add new columns to cafe_menu_items
ALTER TABLE public.cafe_menu_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS is_seasonal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seasonal_label TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calories INTEGER,
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[];

-- Add new columns to cafe_menu_categories
ALTER TABLE public.cafe_menu_categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for cafe menu images
INSERT INTO storage.buckets (id, name, public)
VALUES ('cafe-menu-images', 'cafe-menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for cafe menu images
CREATE POLICY "Public can view cafe menu images"
ON storage.objects FOR SELECT
USING (bucket_id = 'cafe-menu-images');

-- Authenticated users can upload cafe menu images
CREATE POLICY "Staff can upload cafe menu images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cafe-menu-images'
  AND auth.role() = 'authenticated'
);

-- Staff can update cafe menu images
CREATE POLICY "Staff can update cafe menu images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cafe-menu-images'
  AND auth.role() = 'authenticated'
);

-- Staff can delete cafe menu images
CREATE POLICY "Staff can delete cafe menu images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cafe-menu-images'
  AND auth.role() = 'authenticated'
);
