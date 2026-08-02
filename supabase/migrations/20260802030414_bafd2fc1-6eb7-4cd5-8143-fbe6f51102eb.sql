ALTER TABLE public.class_pricing
  ADD COLUMN IF NOT EXISTS classes_included integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

UPDATE public.class_pricing SET classes_included = 10 WHERE pass_type = '10_pack';
UPDATE public.class_pricing SET classes_included = 1 WHERE pass_type = 'single';

CREATE UNIQUE INDEX IF NOT EXISTS class_pricing_unique_tier
  ON public.class_pricing (category, pass_type, audience);