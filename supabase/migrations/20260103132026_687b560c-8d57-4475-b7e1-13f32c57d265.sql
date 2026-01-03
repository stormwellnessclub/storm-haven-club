-- Update link_member_by_email function to include new fields
DROP FUNCTION IF EXISTS public.link_member_by_email();

CREATE OR REPLACE FUNCTION public.link_member_by_email()
RETURNS TABLE(
  id uuid,
  member_id text,
  email text,
  first_name text,
  last_name text,
  status text,
  membership_type text,
  user_id uuid,
  activated_at timestamp with time zone,
  activation_deadline timestamp with time zone,
  approved_at timestamp with time zone,
  gender text,
  is_founding_member boolean,
  annual_fee_paid_at timestamp with time zone,
  locked_start_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_member_record RECORD;
BEGIN
  -- Get the current user's ID and email
  v_user_id := auth.uid();
  v_user_email := (SELECT auth.users.email FROM auth.users WHERE auth.users.id = v_user_id);
  
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
      v_member_record.approved_at,
      v_member_record.gender,
      v_member_record.is_founding_member,
      v_member_record.annual_fee_paid_at,
      v_member_record.locked_start_date;
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
    v_member_record.approved_at,
    v_member_record.gender,
    v_member_record.is_founding_member,
    v_member_record.annual_fee_paid_at,
    v_member_record.locked_start_date;
END;
$function$;