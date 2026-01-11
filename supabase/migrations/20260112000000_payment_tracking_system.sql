-- =====================================================
-- Payment Tracking System
-- Comprehensive tracking for recurring payments, declines, retries, and subscription lifecycle
-- =====================================================

-- =====================================================
-- TABLE: payment_attempts
-- Tracks all payment attempts (successful, failed, retried) for subscriptions and invoices
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_subscription_id TEXT,
  invoice_number TEXT, -- Invoice number from Stripe (e.g., "INV-0001")
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL, -- 'succeeded', 'failed', 'pending', 'requires_action', 'canceled'
  attempt_number INTEGER NOT NULL DEFAULT 1, -- Which retry attempt this is (1 = first attempt)
  payment_method_id TEXT, -- Stripe payment method ID
  payment_method_type TEXT, -- 'card', 'bank_account', etc.
  failure_code TEXT, -- Stripe failure code (e.g., 'card_declined', 'insufficient_funds')
  failure_message TEXT, -- Human-readable failure message
  decline_code TEXT, -- Card decline code (e.g., 'generic_decline', 'insufficient_funds')
  decline_reason TEXT, -- Human-readable decline reason
  retry_attempted BOOLEAN DEFAULT false, -- Whether Stripe will retry this payment
  next_retry_at TIMESTAMPTZ, -- When Stripe will retry (if applicable)
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb -- Additional Stripe data
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_attempts_member_id ON public.payment_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_invoice_id ON public.payment_attempts(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_subscription_id ON public.payment_attempts(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON public.payment_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_failed_at ON public.payment_attempts(failed_at DESC) WHERE failed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_member_status ON public.payment_attempts(member_id, status);

-- Enable RLS
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view all payment attempts
CREATE POLICY "Staff can view all payment attempts"
ON public.payment_attempts
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- RLS: Members can view their own payment attempts
CREATE POLICY "Members can view their own payment attempts"
ON public.payment_attempts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = payment_attempts.member_id
    AND members.user_id = auth.uid()
  )
);

-- RLS: System can insert payment attempts (via SECURITY DEFINER functions)
CREATE POLICY "System can insert payment attempts"
ON public.payment_attempts
FOR INSERT
WITH CHECK (true); -- Controlled via SECURITY DEFINER functions

-- RLS: System can update payment attempts (via SECURITY DEFINER functions)
CREATE POLICY "System can update payment attempts"
ON public.payment_attempts
FOR UPDATE
USING (true); -- Controlled via SECURITY DEFINER functions

-- =====================================================
-- TABLE: subscription_status_history
-- Audit trail of all subscription status changes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscription_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  old_status TEXT, -- Previous status (NULL for initial status)
  new_status TEXT NOT NULL, -- New status
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT DEFAULT 'system', -- 'system', 'stripe', 'admin', or user UUID
  reason TEXT, -- Reason for status change (e.g., 'payment_failed', 'payment_succeeded', 'canceled_by_member')
  stripe_event_id TEXT, -- Stripe event ID that triggered this change (if applicable)
  metadata JSONB DEFAULT '{}'::jsonb -- Additional context
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_member_id ON public.subscription_status_history(member_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_stripe_subscription_id ON public.subscription_status_history(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_changed_at ON public.subscription_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_member_changed ON public.subscription_status_history(member_id, changed_at DESC);

-- Enable RLS
ALTER TABLE public.subscription_status_history ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view all status history
CREATE POLICY "Staff can view all subscription status history"
ON public.subscription_status_history
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- RLS: Members can view their own status history
CREATE POLICY "Members can view their own subscription status history"
ON public.subscription_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = subscription_status_history.member_id
    AND members.user_id = auth.uid()
  )
);

-- RLS: System can insert status history (via SECURITY DEFINER functions)
CREATE POLICY "System can insert subscription status history"
ON public.subscription_status_history
FOR INSERT
WITH CHECK (true); -- Controlled via SECURITY DEFINER functions

-- =====================================================
-- TABLE: payment_method_updates
-- Tracks payment method updates (card changes, expiration updates, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_method_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  payment_method_type TEXT NOT NULL, -- 'card', 'bank_account', etc.
  action TEXT NOT NULL, -- 'added', 'updated', 'removed', 'expired', 'expiring_soon'
  card_brand TEXT, -- 'visa', 'mastercard', 'amex', etc. (for cards)
  card_last4 TEXT, -- Last 4 digits (for cards)
  card_exp_month INTEGER, -- Expiration month (for cards)
  card_exp_year INTEGER, -- Expiration year (for cards)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_event_id TEXT, -- Stripe event ID (if applicable)
  metadata JSONB DEFAULT '{}'::jsonb -- Additional Stripe data
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_member_id ON public.payment_method_updates(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_stripe_customer_id ON public.payment_method_updates(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_updated_at ON public.payment_method_updates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_action ON public.payment_method_updates(action);
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_expiring ON public.payment_method_updates(card_exp_year, card_exp_month) 
  WHERE action IN ('expiring_soon', 'expired');

-- Enable RLS
ALTER TABLE public.payment_method_updates ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view all payment method updates
CREATE POLICY "Staff can view all payment method updates"
ON public.payment_method_updates
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- RLS: Members can view their own payment method updates
CREATE POLICY "Members can view their own payment method updates"
ON public.payment_method_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = payment_method_updates.member_id
    AND members.user_id = auth.uid()
  )
);

-- RLS: System can insert payment method updates (via SECURITY DEFINER functions)
CREATE POLICY "System can insert payment method updates"
ON public.payment_method_updates
FOR INSERT
WITH CHECK (true); -- Controlled via SECURITY DEFINER functions

-- =====================================================
-- FUNCTION: log_payment_attempt
-- Logs a payment attempt (called from webhook handler)
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_payment_attempt(
  p_member_id UUID,
  p_stripe_invoice_id TEXT,
  p_stripe_payment_intent_id TEXT,
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_amount DECIMAL(10,2),
  p_currency TEXT DEFAULT 'usd',
  p_status TEXT,
  p_attempt_number INTEGER DEFAULT 1,
  p_payment_method_id TEXT DEFAULT NULL,
  p_payment_method_type TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_failure_message TEXT DEFAULT NULL,
  p_decline_code TEXT DEFAULT NULL,
  p_decline_reason TEXT DEFAULT NULL,
  p_retry_attempted BOOLEAN DEFAULT false,
  p_next_retry_at TIMESTAMPTZ DEFAULT NULL,
  p_succeeded_at TIMESTAMPTZ DEFAULT NULL,
  p_failed_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO public.payment_attempts (
    member_id,
    stripe_invoice_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_subscription_id,
    invoice_number,
    amount,
    currency,
    status,
    attempt_number,
    payment_method_id,
    payment_method_type,
    failure_code,
    failure_message,
    decline_code,
    decline_reason,
    retry_attempted,
    next_retry_at,
    succeeded_at,
    failed_at,
    metadata
  ) VALUES (
    p_member_id,
    p_stripe_invoice_id,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_stripe_subscription_id,
    p_invoice_number,
    p_amount,
    p_currency,
    p_status,
    p_attempt_number,
    p_payment_method_id,
    p_payment_method_type,
    p_failure_code,
    p_failure_message,
    p_decline_code,
    p_decline_reason,
    p_retry_attempted,
    p_next_retry_at,
    p_succeeded_at,
    p_failed_at,
    p_metadata
  )
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

-- Grant execute to authenticated users (via service role in edge functions)
GRANT EXECUTE ON FUNCTION public.log_payment_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_attempt TO anon;

-- =====================================================
-- FUNCTION: update_subscription_status_with_history
-- Updates member subscription status and logs the change
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_subscription_status_with_history(
  p_member_id UUID,
  p_stripe_subscription_id TEXT,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_changed_by TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_old_status
  FROM public.members
  WHERE id = p_member_id;

  -- Only update if status actually changed
  IF v_old_status IS DISTINCT FROM p_new_status THEN
    -- Update member status
    UPDATE public.members
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_member_id;

    -- Log status change
    INSERT INTO public.subscription_status_history (
      member_id,
      stripe_subscription_id,
      old_status,
      new_status,
      changed_at,
      changed_by,
      reason,
      stripe_event_id,
      metadata
    ) VALUES (
      p_member_id,
      p_stripe_subscription_id,
      v_old_status,
      p_new_status,
      now(),
      p_changed_by,
      p_reason,
      p_stripe_event_id,
      p_metadata
    );
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_subscription_status_with_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_status_with_history TO anon;

-- =====================================================
-- FUNCTION: track_payment_method_update
-- Tracks payment method updates (called from webhook handler)
-- =====================================================
CREATE OR REPLACE FUNCTION public.track_payment_method_update(
  p_member_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_payment_method_id TEXT,
  p_payment_method_type TEXT,
  p_action TEXT,
  p_card_brand TEXT DEFAULT NULL,
  p_card_last4 TEXT DEFAULT NULL,
  p_card_exp_month INTEGER DEFAULT NULL,
  p_card_exp_year INTEGER DEFAULT NULL,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update_id UUID;
BEGIN
  INSERT INTO public.payment_method_updates (
    member_id,
    stripe_customer_id,
    stripe_payment_method_id,
    payment_method_type,
    action,
    card_brand,
    card_last4,
    card_exp_month,
    card_exp_year,
    updated_at,
    stripe_event_id,
    metadata
  ) VALUES (
    p_member_id,
    p_stripe_customer_id,
    p_stripe_payment_method_id,
    p_payment_method_type,
    p_action,
    p_card_brand,
    p_card_last4,
    p_card_exp_month,
    p_card_exp_year,
    now(),
    p_stripe_event_id,
    p_metadata
  )
  RETURNING id INTO v_update_id;

  RETURN v_update_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.track_payment_method_update TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_payment_method_update TO anon;

-- =====================================================
-- Add comments for documentation
-- =====================================================
COMMENT ON TABLE public.payment_attempts IS 'Tracks all payment attempts (successful, failed, retried) for subscriptions and invoices';
COMMENT ON TABLE public.subscription_status_history IS 'Audit trail of all subscription status changes';
COMMENT ON TABLE public.payment_method_updates IS 'Tracks payment method updates (card changes, expiration updates, etc.)';
COMMENT ON FUNCTION public.log_payment_attempt IS 'Logs a payment attempt (called from webhook handler)';
COMMENT ON FUNCTION public.update_subscription_status_with_history IS 'Updates member subscription status and logs the change';
COMMENT ON FUNCTION public.track_payment_method_update IS 'Tracks payment method updates (called from webhook handler)';
