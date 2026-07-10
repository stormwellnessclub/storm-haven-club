DO $$
DECLARE
  frontdesk_user_id uuid;
BEGIN
  SELECT id INTO frontdesk_user_id
  FROM auth.users
  WHERE lower(email) = lower('frontdesk@stormwellnessclub.com')
  LIMIT 1;

  IF frontdesk_user_id IS NULL THEN
    RAISE EXCEPTION 'frontdesk@stormwellnessclub.com account not found';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt('Frontdesk18340', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    aud = COALESCE(aud, 'authenticated'),
    role = COALESCE(role, 'authenticated'),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
    updated_at = now(),
    deleted_at = NULL,
    banned_until = NULL
  WHERE id = frontdesk_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = frontdesk_user_id
    AND role <> 'front_desk';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (frontdesk_user_id, 'front_desk')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;