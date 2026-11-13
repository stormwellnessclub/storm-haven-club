CREATE OR REPLACE FUNCTION public.copy_profile_waiver_into_non_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signed boolean;
  v_signed_at timestamptz;
BEGIN
  IF NEW.user_id IS NULL OR NEW.waiver_signed IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT p.waiver_signed, p.waiver_signed_at
    INTO v_signed, v_signed_at
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  IF v_signed IS TRUE THEN
    NEW.waiver_signed := true;
    NEW.waiver_signed_at := COALESCE(NEW.waiver_signed_at, v_signed_at);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.copy_profile_waiver_into_non_member() IS
  'When a non-member record is created or linked to an account, carry over a waiver already signed on the account profile so staff screens never show a false "waiver pending".';

DROP TRIGGER IF EXISTS trg_sync_waiver_from_profile_on_link ON public.non_member_profiles;
CREATE TRIGGER trg_sync_waiver_from_profile_on_link
BEFORE INSERT OR UPDATE OF user_id ON public.non_member_profiles
FOR EACH ROW
EXECUTE FUNCTION public.copy_profile_waiver_into_non_member();