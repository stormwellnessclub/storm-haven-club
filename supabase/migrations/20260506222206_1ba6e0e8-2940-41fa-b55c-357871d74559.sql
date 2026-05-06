
ALTER TABLE public.mothers_day_vouchers
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_recipient_user_id
  ON public.mothers_day_vouchers(recipient_user_id);

CREATE OR REPLACE FUNCTION public.link_mothers_day_vouchers_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.mothers_day_vouchers
     SET buyer_user_id = NEW.id
   WHERE buyer_user_id IS NULL
     AND lower(buyer_email) = lower(NEW.email);

  UPDATE public.mothers_day_vouchers
     SET recipient_user_id = NEW.id
   WHERE recipient_user_id IS NULL
     AND recipient_email IS NOT NULL
     AND lower(recipient_email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_mothers_day_vouchers_insert ON auth.users;
CREATE TRIGGER trg_link_mothers_day_vouchers_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_mothers_day_vouchers_to_user();

DROP TRIGGER IF EXISTS trg_link_mothers_day_vouchers_update ON auth.users;
CREATE TRIGGER trg_link_mothers_day_vouchers_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.link_mothers_day_vouchers_to_user();

-- Backfill
UPDATE public.mothers_day_vouchers v
   SET buyer_user_id = u.id
  FROM auth.users u
 WHERE v.buyer_user_id IS NULL
   AND lower(v.buyer_email) = lower(u.email);

UPDATE public.mothers_day_vouchers v
   SET recipient_user_id = u.id
  FROM auth.users u
 WHERE v.recipient_user_id IS NULL
   AND v.recipient_email IS NOT NULL
   AND lower(v.recipient_email) = lower(u.email);
