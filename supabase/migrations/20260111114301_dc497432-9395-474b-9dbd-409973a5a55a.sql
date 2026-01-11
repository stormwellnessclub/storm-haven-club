-- Add the missing membership_agreement_signed column to membership_applications
ALTER TABLE public.membership_applications 
ADD COLUMN IF NOT EXISTS membership_agreement_signed boolean NOT NULL DEFAULT false;

-- Create agreements table to store agreement documents
CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  agreement_type text NOT NULL,
  title text NOT NULL,
  description text,
  pdf_url text,
  version text DEFAULT '1.0',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  effective_date date
);

-- Enable RLS
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active agreements (public documents)
CREATE POLICY "Anyone can view active agreements"
  ON public.agreements
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage agreements
CREATE POLICY "Admins can manage agreements"
  ON public.agreements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Insert the membership agreement record
INSERT INTO public.agreements (agreement_type, title, description, pdf_url, is_active, is_required, display_order)
VALUES (
  'membership_agreement',
  'Membership Agreement',
  'Terms and conditions for Storm Wellness Club membership',
  'membership-agreement.pdf',
  true,
  true,
  1
);