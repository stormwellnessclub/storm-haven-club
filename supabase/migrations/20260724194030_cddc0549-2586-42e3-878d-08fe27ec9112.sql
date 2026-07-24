-- Add 'ozone' to credit_type enum
ALTER TYPE public.credit_type ADD VALUE IF NOT EXISTS 'ozone';

-- Add Spa Room 3
INSERT INTO public.spa_rooms (name)
SELECT 'Spa Room 3'
WHERE NOT EXISTS (SELECT 1 FROM public.spa_rooms WHERE name = 'Spa Room 3');

-- Add Ozone Sauna service under Recovery
INSERT INTO public.spa_services (
  name, description, category, duration_minutes, cleanup_minutes,
  price, is_active, display_order, popular, requires_intake_form
)
SELECT
  'Ozone Sauna',
  'Full-body ozone sauna session for detoxification, circulation, and recovery. 60-minute self-serve session in Spa Room 3.',
  'Recovery',
  60,
  15,
  85.00,
  true,
  100,
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.spa_services WHERE name = 'Ozone Sauna');