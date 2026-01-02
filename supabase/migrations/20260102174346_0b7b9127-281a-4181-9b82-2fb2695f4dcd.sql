-- Create a secure function to link a member record by email
-- This bypasses RLS to allow users to claim their unlinked member record
CREATE OR REPLACE FUNCTION public.link_member_by_email()
RETURNS TABLE (
  id uuid,
  member_id text,
  email text,
  first_name text,
  last_name text,
  status text,
  membership_type text,
  user_id uuid,
  activated_at timestamptz,
  activation_deadline timestamptz,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_member_record RECORD;
BEGIN
  -- Get the current user's ID and email
  v_user_id := auth.uid();
  v_user_email := (SELECT email FROM auth.users WHERE auth.users.id = v_user_id);
  
  IF v_user_id IS NULL OR v_user_email IS NULL THEN
    RETURN;
  END IF;
  
  -- First check if user already has a linked member record
  SELECT m.* INTO v_member_record
  FROM public.members m
  WHERE m.user_id = v_user_id
  LIMIT 1;
  
  IF FOUND THEN
    -- Return the already-linked record
    RETURN QUERY
    SELECT 
      v_member_record.id,
      v_member_record.member_id,
      v_member_record.email,
      v_member_record.first_name,
      v_member_record.last_name,
      v_member_record.status,
      v_member_record.membership_type,
      v_member_record.user_id,
      v_member_record.activated_at,
      v_member_record.activation_deadline,
      v_member_record.approved_at;
    RETURN;
  END IF;
  
  -- Find an unlinked member record with matching email (most recent first)
  SELECT m.* INTO v_member_record
  FROM public.members m
  WHERE m.user_id IS NULL
    AND LOWER(m.email) = LOWER(v_user_email)
  ORDER BY m.created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Link the member record to this user
  UPDATE public.members
  SET user_id = v_user_id,
      updated_at = now()
  WHERE public.members.id = v_member_record.id;
  
  -- Return the newly linked record
  RETURN QUERY
  SELECT 
    v_member_record.id,
    v_member_record.member_id,
    v_member_record.email,
    v_member_record.first_name,
    v_member_record.last_name,
    v_member_record.status,
    v_member_record.membership_type,
    v_user_id,
    v_member_record.activated_at,
    v_member_record.activation_deadline,
    v_member_record.approved_at;
END;
$$;