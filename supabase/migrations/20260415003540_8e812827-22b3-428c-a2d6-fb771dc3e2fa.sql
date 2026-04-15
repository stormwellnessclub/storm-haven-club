-- Change service_id from integer to text to support UUID service IDs
ALTER TABLE public.spa_appointments 
  ALTER COLUMN service_id TYPE text USING service_id::text;