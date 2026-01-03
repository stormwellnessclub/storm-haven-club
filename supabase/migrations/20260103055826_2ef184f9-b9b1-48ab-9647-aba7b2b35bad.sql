-- Create member_freezes table for tracking membership freeze requests
CREATE TABLE public.member_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Request details
  requested_start_date DATE NOT NULL,
  requested_end_date DATE NOT NULL,
  duration_months INTEGER NOT NULL CHECK (duration_months >= 1 AND duration_months <= 2),
  reason TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'cancelled')),
  
  -- Approval/Rejection
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Fee tracking ($20/month)
  freeze_fee_total NUMERIC NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  fee_paid BOOLEAN DEFAULT FALSE,
  
  -- Actual freeze dates (may differ from requested after approval)
  actual_start_date DATE,
  actual_end_date DATE,
  
  -- Year tracking for annual limit (max 2 months per calendar year)
  freeze_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.member_freezes ENABLE ROW LEVEL SECURITY;

-- Members can view their own freezes
CREATE POLICY "Members can view their own freezes"
ON public.member_freezes FOR SELECT
USING (auth.uid() = user_id);

-- Members can create freeze requests
CREATE POLICY "Members can create freeze requests"
ON public.member_freezes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Members can cancel their pending requests
CREATE POLICY "Members can cancel pending requests"
ON public.member_freezes FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Staff can view all freezes
CREATE POLICY "Staff can view all freezes"
ON public.member_freezes FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Staff can manage all freezes
CREATE POLICY "Staff can manage all freezes"
ON public.member_freezes FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- Create updated_at trigger
CREATE TRIGGER update_member_freezes_updated_at
  BEFORE UPDATE ON public.member_freezes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_member_freezes_member_id ON public.member_freezes(member_id);
CREATE INDEX idx_member_freezes_status ON public.member_freezes(status);
CREATE INDEX idx_member_freezes_year ON public.member_freezes(freeze_year);