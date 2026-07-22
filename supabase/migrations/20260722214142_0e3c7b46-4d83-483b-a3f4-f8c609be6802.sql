
ALTER TABLE public.non_member_profiles
  ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS class_package_agreement_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS class_package_agreement_signed_at timestamptz;
