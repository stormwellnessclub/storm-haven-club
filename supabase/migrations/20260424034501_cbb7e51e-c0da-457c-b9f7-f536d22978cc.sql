DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'contact@stormfitnessandwellness.com';
  v_password text := 'Romules143!';
  v_encrypted_pw text;
BEGIN
  -- Generate bcrypt hash of the password
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create new auth user
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      NULL,
      NULL,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Create identity row (required for email/password login)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    -- Update existing user's password and confirm email
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    -- Ensure identity row exists with proper sub claim
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email',
        v_user_id::text,
        now(), now(), now()
      );
    ELSE
      UPDATE auth.identities
      SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
          updated_at = now()
      WHERE user_id = v_user_id AND provider = 'email';
    END IF;
  END IF;

  -- Assign super_admin role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Super admin ready: % (id=%)', v_email, v_user_id;
END $$;