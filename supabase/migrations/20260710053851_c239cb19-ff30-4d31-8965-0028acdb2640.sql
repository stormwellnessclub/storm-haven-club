
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'frontdesk@stormwellnessclub.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'frontdesk@stormwellnessclub.com',
      crypt('Frontdesk18340', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, false
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', 'frontdesk@stormwellnessclub.com', 'email_verified', true),
      'email',
      new_user_id::text,
      now(), now(), now()
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'front_desk')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
