CREATE OR REPLACE FUNCTION public.link_spa_guest_to_existing_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid; v_cnt int;
BEGIN
  IF NEW.user_id IS NULL AND NEW.guest_email IS NOT NULL AND btrim(NEW.guest_email) <> '' THEN
    SELECT count(DISTINCT user_id), min(user_id::text)::uuid INTO v_cnt, v_uid
      FROM public.profiles WHERE lower(btrim(email)) = lower(btrim(NEW.guest_email)) AND user_id IS NOT NULL;
    IF v_cnt = 1 THEN
      NEW.user_id := v_uid;
      IF NEW.member_id IS NULL THEN
        NEW.member_id := (SELECT id FROM public.members WHERE user_id = v_uid AND status <> 'cancelled' LIMIT 1);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_link_spa_guest_to_existing_account ON public.spa_appointments;
CREATE TRIGGER trg_link_spa_guest_to_existing_account BEFORE INSERT ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.link_spa_guest_to_existing_account();