ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merged_into_user_id uuid;
ALTER TABLE public.non_member_profiles ADD COLUMN IF NOT EXISTS merged_into_user_id uuid;
COMMENT ON COLUMN public.profiles.merged_into_user_id IS 'Duplicate login merged into this canonical user_id; hidden from client pickers.';
COMMENT ON COLUMN public.non_member_profiles.merged_into_user_id IS 'Duplicate login merged into this canonical user_id; hidden from client pickers.';