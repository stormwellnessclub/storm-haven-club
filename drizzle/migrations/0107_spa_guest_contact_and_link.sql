ALTER TABLE public.spa_appointments ADD COLUMN IF NOT EXISTS guest_name text, ADD COLUMN IF NOT EXISTS guest_email text, ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE public.spa_service_requests ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_spa_appt_guest_email ON public.spa_appointments (lower(guest_email)) WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION public.link_spa_guest_appointments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.spa_appointments
       SET user_id = NEW.user_id
     WHERE user_id IS NULL
       AND guest_email IS NOT NULL
       AND lower(trim(guest_email)) = lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_spa_guest_appts ON public.profiles;
CREATE TRIGGER trg_link_spa_guest_appts AFTER INSERT OR UPDATE OF email, user_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_spa_guest_appointments();