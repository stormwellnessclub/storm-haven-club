ALTER TABLE public.spa_appointments
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addons_total numeric NOT NULL DEFAULT 0;

INSERT INTO public.spa_service_addons (name, description, price, duration_minutes, is_active, applicable_categories)
SELECT 'CBD', 'CBD oil enhancement', 20, 0, true, ARRAY['massage']
WHERE NOT EXISTS (SELECT 1 FROM public.spa_service_addons WHERE lower(name) = 'cbd');