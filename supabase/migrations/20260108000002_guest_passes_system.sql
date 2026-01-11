-- Guest Pass System Migration
-- Creates table for guest passes (day passes, week passes, member guest passes)

-- Create guest_passes table (using pass_status enum which already exists)
-- Guest passes provide access to gym and amenities only (not classes, red light therapy, or zero body cryo)
-- Subject to availability
CREATE TABLE IF NOT EXISTS public.guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional: for non-members, may be NULL
  price_paid DECIMAL(10,2) NOT NULL DEFAULT 60.00,
  status pass_status NOT NULL DEFAULT 'active', -- Using existing pass_status enum ('active', 'expired', 'exhausted')
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- 1 day from purchase
  used_at TIMESTAMPTZ, -- When the pass was used/checked in
  stripe_payment_intent_id TEXT, -- For payment tracking
  stripe_session_id TEXT, -- Stripe checkout session ID
  purchased_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin user who sold the pass
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;

-- Staff can view all guest passes
CREATE POLICY "Staff can view all guest passes"
ON public.guest_passes FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Staff can create guest passes
CREATE POLICY "Staff can create guest passes"
ON public.guest_passes FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Staff can update guest passes (e.g., mark as used)
CREATE POLICY "Staff can update guest passes"
ON public.guest_passes FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Users can view their own guest passes (if they have a user_id)
CREATE POLICY "Users can view their own guest passes"
ON public.guest_passes FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON public.guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_guest_passes_expires_at ON public.guest_passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_passes_stripe_session_id ON public.guest_passes(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_purchased_at ON public.guest_passes(purchased_at DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_guest_passes_updated_at
  BEFORE UPDATE ON public.guest_passes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to mark guest pass as used
-- Note: Using 'exhausted' status (from pass_status enum) to represent used guest passes
CREATE OR REPLACE FUNCTION public.mark_guest_pass_used(p_pass_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pass_record RECORD;
BEGIN
  -- Get the pass record
  SELECT * INTO _pass_record
  FROM public.guest_passes
  WHERE id = p_pass_id
    AND status = 'active'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Guest pass not found, already used, or expired'
    );
  END IF;

  -- Mark as exhausted (used)
  UPDATE public.guest_passes
  SET status = 'exhausted', -- Using 'exhausted' to represent used guest passes
      used_at = now(),
      updated_at = now()
  WHERE id = p_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'pass_id', p_pass_id,
    'guest_name', _pass_record.guest_name
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.mark_guest_pass_used(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guest_pass_used(UUID) TO anon;
