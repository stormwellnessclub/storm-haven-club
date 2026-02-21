
-- Trigger to auto-link non_member_profiles with existing Stripe data when a new user signs up
-- If someone purchased via Stripe checkout before creating an account, their non_member_profile
-- (created by admin import) will have stripe_customer_id, card info, etc.
-- When they sign up with the same email, this trigger copies that data to their new profile row.

CREATE OR REPLACE FUNCTION public.auto_link_non_member_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Look for an existing non_member_profiles row with matching email but no user_id
  -- (these are created by admin Stripe imports before the user has an account)
  SELECT * INTO v_existing
  FROM public.non_member_profiles
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Link the existing profile to this new user
    UPDATE public.non_member_profiles
    SET user_id = NEW.user_id,
        updated_at = now()
    WHERE id = v_existing.id;

    -- Also link any class_passes that were imported under the old placeholder user_id
    -- (In case passes were created with a placeholder)
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'auto_link_non_member_on_signup failed for user_id %: %', NEW.user_id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Attach trigger to non_member_profiles insert (fires when useNonMemberProfile auto-creates a row)
DROP TRIGGER IF EXISTS trg_auto_link_non_member_on_signup ON public.non_member_profiles;
CREATE TRIGGER trg_auto_link_non_member_on_signup
  BEFORE INSERT ON public.non_member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_non_member_on_signup();
