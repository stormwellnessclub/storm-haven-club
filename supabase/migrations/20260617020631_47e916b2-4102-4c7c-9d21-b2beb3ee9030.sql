ALTER TABLE public.cafe_menu_items
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.cafe_menu_items
  SET image_urls = ARRAY[image_url]
  WHERE image_url IS NOT NULL
    AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

CREATE OR REPLACE FUNCTION public.sync_cafe_menu_image_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.image_urls IS NOT NULL AND array_length(NEW.image_urls, 1) >= 1 THEN
    NEW.image_url := NEW.image_urls[1];
  ELSE
    NEW.image_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cafe_menu_image_url ON public.cafe_menu_items;
CREATE TRIGGER trg_sync_cafe_menu_image_url
  BEFORE INSERT OR UPDATE OF image_urls ON public.cafe_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_cafe_menu_image_url();