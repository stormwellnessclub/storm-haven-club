ALTER TABLE public.class_types ADD COLUMN IF NOT EXISTS is_signature boolean NOT NULL DEFAULT false;
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_class_types_is_signature ON public.class_types(is_signature) WHERE is_signature = true;
CREATE INDEX IF NOT EXISTS idx_instructors_is_master ON public.instructors(is_master) WHERE is_master = true;