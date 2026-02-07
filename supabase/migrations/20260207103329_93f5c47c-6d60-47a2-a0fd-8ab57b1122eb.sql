-- Add missing timestamp columns to profiles table for agreement tracking
-- These columns are expected by the frontend but don't exist in the database

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kids_care_service_form_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed_at TIMESTAMPTZ;