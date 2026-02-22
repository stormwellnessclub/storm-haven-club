CREATE OR REPLACE FUNCTION public.auto_fulfill_pending_import()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending RECORD;
BEGIN
  -- Look for a pending import matching this email
  SELECT * INTO v_pending
  FROM public.pending_non_member_imports
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Create the class pass
    INSERT INTO public.class_passes (
      user_id,
      category,
      pass_type,
      classes_total,
      classes_remaining,
      price_paid,
      is_member_price,
      purchased_at,
      expires_at,
      status
    ) VALUES (
      NEW.user_id,
      v_pending.pass_category,
      v_pending.pass_type,
      v_pending.classes_total,
      v_pending.classes_total,
      0,
      false,
      now(),
      now() + (v_pending.expiration_days || ' days')::interval,
      'active'
    );

    -- Copy profile data (name, phone) to non_member_profiles
    UPDATE public.non_member_profiles
    SET first_name = v_pending.first_name,
        last_name  = v_pending.last_name,
        phone      = v_pending.phone
    WHERE user_id = NEW.user_id
      AND (first_name IS NULL OR first_name = '');

    -- Mark the import as fulfilled
    UPDATE public.pending_non_member_imports
    SET status = 'fulfilled',
        fulfilled_at = now(),
        fulfilled_user_id = NEW.user_id
    WHERE id = v_pending.id;
  END IF;

  RETURN NEW;
END;
$function$;