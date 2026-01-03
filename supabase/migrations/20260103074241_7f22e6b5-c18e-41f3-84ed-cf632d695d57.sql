-- Function to auto-link member records when a profile is created
CREATE OR REPLACE FUNCTION public.auto_link_member_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to link any unlinked member with matching email
  UPDATE public.members
  SET user_id = NEW.user_id,
      updated_at = now()
  WHERE user_id IS NULL
    AND LOWER(email) = LOWER(NEW.email)
    AND status IN ('pending_activation', 'active', 'frozen', 'suspended');
  
  -- Return NEW regardless of whether we updated anything (don't block signup)
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block profile creation, just log and continue
    RAISE WARNING 'auto_link_member_on_profile_create failed for user_id %: %', NEW.user_id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to run after profile insert
DROP TRIGGER IF EXISTS trigger_auto_link_member ON public.profiles;
CREATE TRIGGER trigger_auto_link_member
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_member_on_profile_create();