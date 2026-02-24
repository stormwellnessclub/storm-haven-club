-- Allow member_credits to be created for members without auth accounts
ALTER TABLE public.member_credits ALTER COLUMN user_id DROP NOT NULL;