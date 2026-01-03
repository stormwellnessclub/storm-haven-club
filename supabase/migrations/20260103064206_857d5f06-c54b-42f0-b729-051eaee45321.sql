-- Link the existing test member to their user account
UPDATE public.members 
SET user_id = '4fd4efaa-7dd9-4b72-a16e-6f734c8ea455', updated_at = now()
WHERE LOWER(email) = 'dhuha1125@yahoo.com' AND user_id IS NULL;

-- Create admin function to manually link members to user accounts
CREATE OR REPLACE FUNCTION public.admin_link_member_to_user(
  _member_id uuid,
  _user_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only allow admins to run this
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Find the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(_user_email)
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN false; -- User not found
  END IF;
  
  -- Link the member to the user
  UPDATE public.members
  SET user_id = v_user_id, updated_at = now()
  WHERE id = _member_id AND user_id IS NULL;
  
  RETURN FOUND;
END;
$$;