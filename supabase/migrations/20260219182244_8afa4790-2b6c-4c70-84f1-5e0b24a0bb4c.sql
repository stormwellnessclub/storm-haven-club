
ALTER TABLE public.non_member_profiles
ADD COLUMN waiver_signed boolean NOT NULL DEFAULT false,
ADD COLUMN waiver_signed_at timestamp with time zone;
