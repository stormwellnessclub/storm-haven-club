-- Sync phone from members → profiles
CREATE OR REPLACE FUNCTION public.sync_phone_members_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET phone = NEW.phone
    WHERE id = NEW.user_id
      AND (phone IS NULL OR phone = '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phone_members_to_profiles ON public.members;
CREATE TRIGGER trg_sync_phone_members_to_profiles
AFTER INSERT OR UPDATE OF phone ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.sync_phone_members_to_profiles();

-- Sync phone from membership_applications → profiles + non_member_profiles by email
CREATE OR REPLACE FUNCTION public.sync_phone_applications_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' AND NEW.email IS NOT NULL THEN
    UPDATE public.profiles
    SET phone = NEW.phone
    WHERE LOWER(email) = LOWER(NEW.email)
      AND (phone IS NULL OR phone = '');

    UPDATE public.non_member_profiles
    SET phone = NEW.phone
    WHERE LOWER(email) = LOWER(NEW.email)
      AND (phone IS NULL OR phone = '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phone_applications_to_profiles ON public.membership_applications;
CREATE TRIGGER trg_sync_phone_applications_to_profiles
AFTER INSERT OR UPDATE OF phone ON public.membership_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_phone_applications_to_profiles();