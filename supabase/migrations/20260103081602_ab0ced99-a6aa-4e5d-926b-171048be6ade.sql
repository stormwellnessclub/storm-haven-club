-- Create manual_charges table to track off-cycle charges
CREATE TABLE public.manual_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  charged_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for member lookup
CREATE INDEX idx_manual_charges_member_id ON public.manual_charges(member_id);
CREATE INDEX idx_manual_charges_status ON public.manual_charges(status);

-- Enable RLS
ALTER TABLE public.manual_charges ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all manual charges"
ON public.manual_charges FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

CREATE POLICY "Admins can insert manual charges"
ON public.manual_charges FOR INSERT
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

CREATE POLICY "Admins can update manual charges"
ON public.manual_charges FOR UPDATE
USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Trigger for updated_at
CREATE TRIGGER update_manual_charges_updated_at
BEFORE UPDATE ON public.manual_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();