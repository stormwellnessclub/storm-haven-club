DELETE FROM public.profiles WHERE user_id = '495d475c-1b53-4352-9726-e6e678427b6e';
UPDATE auth.users
SET banned_until = 'infinity',
    encrypted_password = NULL,
    email_change = '',
    raw_user_meta_data = '{"disposable_gate_c_test":true}'::jsonb
WHERE id = '495d475c-1b53-4352-9726-e6e678427b6e';