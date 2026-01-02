-- Create credit adjustments audit log table
CREATE TABLE public.credit_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_credit_id UUID REFERENCES public.member_credits(id) ON DELETE SET NULL,
  credit_type TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'remove')),
  amount INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL,
  new_balance INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_adjustments ENABLE ROW LEVEL SECURITY;

-- Staff can view all adjustments
CREATE POLICY "Staff can view credit adjustments"
ON public.credit_adjustments
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- Staff can create adjustments
CREATE POLICY "Staff can create credit adjustments"
ON public.credit_adjustments
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- Create index for faster queries
CREATE INDEX idx_credit_adjustments_member_id ON public.credit_adjustments(member_id);
CREATE INDEX idx_credit_adjustments_created_at ON public.credit_adjustments(created_at DESC);