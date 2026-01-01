-- Create credit type enum
CREATE TYPE credit_type AS ENUM ('class', 'red_light', 'dry_cryo');

-- Create member_credits table with cycle-based tracking
CREATE TABLE public.member_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  credit_type credit_type NOT NULL,
  credits_total INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, credit_type, cycle_start)
);

-- Enable RLS
ALTER TABLE public.member_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own credits"
ON public.member_credits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all credits"
ON public.member_credits
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

CREATE POLICY "Staff can manage credits"
ON public.member_credits
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Trigger for updated_at
CREATE TRIGGER update_member_credits_updated_at
  BEFORE UPDATE ON public.member_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();