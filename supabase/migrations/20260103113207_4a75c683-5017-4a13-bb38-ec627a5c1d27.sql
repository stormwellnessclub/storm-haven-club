-- Add application_id to manual_charges for tracking pre-member charges
ALTER TABLE public.manual_charges 
  ALTER COLUMN member_id DROP NOT NULL,
  ADD COLUMN application_id uuid REFERENCES public.membership_applications(id);

-- Add index for faster lookups
CREATE INDEX idx_manual_charges_application_id ON public.manual_charges(application_id);

-- Update RLS to allow viewing charges by application_id for admins (already covered by existing policies)