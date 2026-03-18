CREATE OR REPLACE FUNCTION public.sync_non_member_profile_from_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.first_name IS NULL OR NEW.last_name IS NULL OR NEW.phone IS NULL THEN
    UPDATE non_member_profiles
    SET first_name = COALESCE(NEW.first_name, p.first_name),
        last_name = COALESCE(NEW.last_name, p.last_name),
        phone = COALESCE(NEW.phone, p.phone)
    FROM profiles p
    WHERE p.user_id = NEW.user_id
      AND non_member_profiles.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_non_member_profile_from_profiles
AFTER INSERT ON non_member_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_non_member_profile_from_profiles();