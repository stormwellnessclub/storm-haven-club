CREATE OR REPLACE FUNCTION public.sync_phone_members_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    -- Update existing profile (by user_id) only if its phone is blank
    UPDATE public.profiles
       SET phone = NEW.phone
     WHERE user_id = NEW.user_id
       AND (phone IS NULL OR phone = '');

    -- If no profile exists for this user, create one
    IF NOT FOUND AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id
    ) THEN
      INSERT INTO public.profiles (user_id, email, first_name, last_name, phone)
      VALUES (NEW.user_id, NEW.email, NEW.first_name, NEW.last_name, NEW.phone);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;