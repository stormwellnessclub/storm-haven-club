-- Create refund_requests table for tracking all refunds
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  original_charge_id UUID REFERENCES public.manual_charges(id) ON DELETE SET NULL,
  original_payment_intent_id TEXT,
  charge_type TEXT NOT NULL, -- 'membership_dues', 'initiation_fee', 'annual_fee', 'class_package', 'spa', 'cafe', 'manual_charge'
  refund_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'partial'
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'processed', 'failed', 'cancelled'
  requested_by UUID REFERENCES auth.users(id),
  manager_code TEXT, -- tracking code for manager
  approved_by UUID REFERENCES auth.users(id), -- super_admin user_id for membership charges
  stripe_refund_id TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add manager_refund_code to profiles for tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_refund_code TEXT;

-- Create admin_action_log table for tracking all admin actions (for undo)
CREATE TABLE public.admin_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'create_subscription', 'cancel_subscription', 'status_change', 'sell_membership', 'sell_class_package', 'refund', 'undo'
  action_data JSONB NOT NULL DEFAULT '{}', -- stores state before action for undo
  performed_by UUID REFERENCES auth.users(id),
  can_undo BOOLEAN NOT NULL DEFAULT true,
  undo_expires_at TIMESTAMPTZ, -- 24 hour window for undo
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for refund_requests - only staff can access
CREATE POLICY "Staff can view refund requests"
ON public.refund_requests
FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Staff can create refund requests"
ON public.refund_requests
FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Staff can update refund requests"
ON public.refund_requests
FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

-- RLS Policies for admin_action_log - only staff can access
CREATE POLICY "Staff can view admin action log"
ON public.admin_action_log
FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Staff can create admin action log"
ON public.admin_action_log
FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Staff can update admin action log"
ON public.admin_action_log
FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

-- Create indexes for performance
CREATE INDEX idx_refund_requests_member_id ON public.refund_requests(member_id);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX idx_refund_requests_created_at ON public.refund_requests(created_at DESC);
CREATE INDEX idx_admin_action_log_member_id ON public.admin_action_log(member_id);
CREATE INDEX idx_admin_action_log_action_type ON public.admin_action_log(action_type);
CREATE INDEX idx_admin_action_log_can_undo ON public.admin_action_log(can_undo) WHERE can_undo = true;

-- Add trigger for updated_at on refund_requests
CREATE TRIGGER update_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();