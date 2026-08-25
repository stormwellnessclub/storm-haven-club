ALTER TABLE public.non_member_profiles
  ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed_at timestamptz;