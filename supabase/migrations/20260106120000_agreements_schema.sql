-- Agreements System Migration
-- Creates tables for managing agreements, forms, and tracking signatures

-- Agreements Table (Admin Management)
CREATE TABLE IF NOT EXISTS public.agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN (
    'liability_waiver', 
    'membership_agreement', 
    'class_package', 
    'guest_pass', 
    'private_event', 
    'single_class_pass', 
    'kids_care'
  )),
  title TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  version TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Forms Table (For fillable forms separate from agreements)
CREATE TABLE IF NOT EXISTS public.forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_type TEXT NOT NULL CHECK (form_type IN (
    'kids_care_service', 
    'kids_care_minor_consent', 
    'private_event', 
    'private_event_class'
  )),
  title TEXT NOT NULL,
  pdf_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Member Forms Table (Stores submitted form data)
CREATE TABLE IF NOT EXISTS public.member_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  form_type TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  pdf_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add agreement signature fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kids_care_agreement_signed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS kids_care_agreement_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kids_care_service_form_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS kids_care_service_form_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS class_package_agreement_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS private_event_agreement_signed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS private_event_agreement_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed_at TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agreements table
-- Anyone can view active agreements (for members to read)
CREATE POLICY "Anyone can view active agreements"
ON public.agreements
FOR SELECT
USING (is_active = true);

-- Staff can manage agreements
CREATE POLICY "Staff can manage agreements"
ON public.agreements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin', 'manager')
  )
);

-- RLS Policies for forms table
-- Anyone can view active forms
CREATE POLICY "Anyone can view active forms"
ON public.forms
FOR SELECT
USING (is_active = true);

-- Staff can manage forms
CREATE POLICY "Staff can manage forms"
ON public.forms
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin', 'manager')
  )
);

-- RLS Policies for member_forms table
-- Members can view their own forms
CREATE POLICY "Members can view their own forms"
ON public.member_forms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_forms.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can create their own forms
CREATE POLICY "Members can create their own forms"
ON public.member_forms
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_forms.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can update their own forms
CREATE POLICY "Members can update their own forms"
ON public.member_forms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_forms.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all member forms
CREATE POLICY "Staff can view all member forms"
ON public.member_forms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin', 'manager', 'front_desk')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agreements_type ON public.agreements(agreement_type);
CREATE INDEX IF NOT EXISTS idx_agreements_active ON public.agreements(is_active);
CREATE INDEX IF NOT EXISTS idx_forms_type ON public.forms(form_type);
CREATE INDEX IF NOT EXISTS idx_member_forms_member_id ON public.member_forms(member_id);
CREATE INDEX IF NOT EXISTS idx_member_forms_form_type ON public.member_forms(form_type);

-- Create trigger for updated_at
CREATE TRIGGER update_agreements_updated_at
BEFORE UPDATE ON public.agreements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_forms_updated_at
BEFORE UPDATE ON public.member_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial agreement records (based on existing PDFs)
-- PDF URLs use relative paths that will be imported in the frontend
INSERT INTO public.agreements (agreement_type, title, pdf_url, display_order, is_required, version, is_active) VALUES
('liability_waiver', 'Liability Waiver', 'liability-waiver.pdf', 1, true, '1.0', true),
('membership_agreement', 'Membership Agreement', 'membership-agreement.pdf', 2, true, '1.0', true),
('kids_care', 'Kids Care Agreement', 'kids-care-agreement.pdf', 1, true, '1.0', true),
('kids_care', 'Kids Care Parent Consent Form', 'kids-care-agreement-parent-consent-form.pdf', 2, true, '1.0', true),
('guest_pass', 'Guest Pass - Membership Agreement', 'guest-pass-agreement-general.pdf', 1, true, '1.0', true),
('guest_pass', 'Guest Pass Agreement', 'guest-pass-agreement.pdf', 2, true, '1.0', true),
('private_event', 'Private Event Agreement', 'private-event-agreement.pdf', 1, true, '1.0', true),
('single_class_pass', 'Single Class Pass Agreement', 'single-class-pass-agreement.pdf', 1, true, '1.0', true),
('single_class_pass', 'Single Class Pass Agreement - Part 2', 'single-class-pass-agreement-2.pdf', 2, true, '1.0', true)
ON CONFLICT DO NOTHING;

-- Insert initial form records
INSERT INTO public.forms (form_type, title, pdf_url, description, is_active) VALUES
('kids_care_service', 'Kids Care Service Set-Up Form', 'kids-care-service-set-up.pdf', 'Service setup form for parents to complete before booking Kids Care services', true),
('kids_care_minor_consent', 'Kids Minor Parent Consent Form', 'kids-minor-parent-consent-form.pdf', 'Additional consent form for minors', true),
('private_event', 'Private Event Form', 'other-private-event-form.pdf', 'Private event booking form', true)
ON CONFLICT DO NOTHING;

