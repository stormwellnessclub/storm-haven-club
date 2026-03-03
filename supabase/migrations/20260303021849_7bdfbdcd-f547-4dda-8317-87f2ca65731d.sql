
-- Trigger function: auto-fulfill pending imports when the user already has an account
CREATE OR REPLACE FUNCTION public.auto_fulfill_import_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Check if a non_member_profile already exists with this email and a linked user
  SELECT * INTO v_profile
  FROM public.non_member_profiles
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NOT NULL
  LIMIT 1;

  IF FOUND THEN
    -- Create class pass immediately
    INSERT INTO public.class_passes (
      user_id, category, pass_type, classes_total, classes_remaining,
      price_paid, is_member_price, purchased_at, expires_at, status
    ) VALUES (
      v_profile.user_id,
      NEW.pass_category,
      NEW.pass_type,
      NEW.classes_total,
      NEW.classes_total,
      0,
      false,
      now(),
      now() + (NEW.expiration_days || ' days')::interval,
      'active'
    );

    -- Copy profile data if present and profile fields are empty
    UPDATE public.non_member_profiles
    SET
      first_name = COALESCE(non_member_profiles.first_name, NEW.first_name),
      last_name = COALESCE(non_member_profiles.last_name, NEW.last_name),
      phone = COALESCE(non_member_profiles.phone, NEW.phone),
      updated_at = now()
    WHERE id = v_profile.id;

    -- Mark import as fulfilled
    NEW.status := 'fulfilled';
    NEW.fulfilled_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_auto_fulfill_import_on_insert
  BEFORE INSERT ON public.pending_non_member_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fulfill_import_on_insert();
