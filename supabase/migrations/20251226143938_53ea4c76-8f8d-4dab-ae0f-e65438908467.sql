-- Create membership applications table
CREATE TABLE public.membership_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Personal Information
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'United States of America (USA)',
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Membership Details
  membership_plan TEXT NOT NULL,
  wellness_goals TEXT[] NOT NULL DEFAULT '{}',
  other_goals TEXT,
  services_interested TEXT[] NOT NULL DEFAULT '{}',
  other_services TEXT,
  
  -- Background
  previous_member TEXT,
  motivations TEXT[] DEFAULT '{}',
  other_motivation TEXT,
  lifestyle_integration TEXT,
  holistic_wellness TEXT,
  referred_by_member TEXT NOT NULL,
  founding_member TEXT NOT NULL,
  
  -- Payment confirmation (not storing actual card data)
  payment_info_provided BOOLEAN NOT NULL DEFAULT true,
  
  -- Agreements
  credit_card_auth BOOLEAN NOT NULL DEFAULT false,
  one_year_commitment BOOLEAN NOT NULL DEFAULT false,
  auth_acknowledgment BOOLEAN NOT NULL DEFAULT false,
  submission_confirmation BOOLEAN NOT NULL DEFAULT false,
  
  -- Application status
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.membership_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert applications (public form)
CREATE POLICY "Anyone can submit an application"
ON public.membership_applications
FOR INSERT
WITH CHECK (true);

-- No public read access - only accessible via service role (backend)
-- This keeps applicant PII secure

-- Create trigger for updated_at
CREATE TRIGGER update_membership_applications_updated_at
BEFORE UPDATE ON public.membership_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on email for lookup
CREATE INDEX idx_membership_applications_email ON public.membership_applications(email);

-- Create index on status for filtering
CREATE INDEX idx_membership_applications_status ON public.membership_applications(status);