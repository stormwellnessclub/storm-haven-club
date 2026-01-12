-- ============================================
-- STEP 1: DROP CONFLICTING OBJECTS
-- ============================================

-- Drop existing conflicting functions
DROP FUNCTION IF EXISTS public.get_payment_metrics(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_subscription_health();
DROP FUNCTION IF EXISTS public.get_dunning_efficiency(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_member_payment_history(UUID, INTEGER);

-- Drop existing RLS policies on payment_attempts
DROP POLICY IF EXISTS "Staff can view all payment attempts" ON public.payment_attempts;
DROP POLICY IF EXISTS "Members can view their own payment attempts" ON public.payment_attempts;

-- Drop existing simpler payment_attempts table
DROP TABLE IF EXISTS public.payment_attempts;

-- ============================================
-- STEP 2: PAYMENT TRACKING SYSTEM (First Migration)
-- ============================================

-- Payment Attempts Table - tracks every payment attempt
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    invoice_id TEXT,
    invoice_number TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL, -- 'succeeded', 'failed', 'pending', 'requires_action'
    attempt_number INTEGER DEFAULT 1,
    failure_code TEXT,
    failure_message TEXT,
    decline_code TEXT,
    decline_reason TEXT,
    next_retry_at TIMESTAMPTZ,
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription Status History - audit trail for status changes
CREATE TABLE IF NOT EXISTS public.subscription_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    stripe_event_id TEXT,
    changed_by TEXT, -- 'webhook', 'admin', 'system'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment Method Updates - tracks card additions, updates, expirations
CREATE TABLE IF NOT EXISTS public.payment_method_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    payment_method_id TEXT,
    event_type TEXT NOT NULL, -- 'added', 'updated', 'removed', 'expiring_soon', 'expired'
    card_last4 TEXT,
    card_brand TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_attempts
CREATE POLICY "Staff can view all payment attempts" ON public.payment_attempts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
        )
    );

CREATE POLICY "Members can view their own payment attempts" ON public.payment_attempts
    FOR SELECT
    USING (
        member_id IN (
            SELECT id FROM public.members WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for subscription_status_history
CREATE POLICY "Staff can view all subscription history" ON public.subscription_status_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
        )
    );

CREATE POLICY "Members can view their own subscription history" ON public.subscription_status_history
    FOR SELECT
    USING (
        member_id IN (
            SELECT id FROM public.members WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for payment_method_updates
CREATE POLICY "Staff can view all payment method updates" ON public.payment_method_updates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
        )
    );

CREATE POLICY "Members can view their own payment method updates" ON public.payment_method_updates
    FOR SELECT
    USING (
        member_id IN (
            SELECT id FROM public.members WHERE user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_attempts_member_id ON public.payment_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice_id ON public.payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON public.payment_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_member_id ON public.subscription_status_history(member_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status_history_created_at ON public.subscription_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_method_updates_member_id ON public.payment_method_updates(member_id);

-- Function to log payment attempts (called from webhook)
CREATE OR REPLACE FUNCTION public.log_payment_attempt(
    p_member_id UUID,
    p_invoice_id TEXT,
    p_invoice_number TEXT,
    p_amount NUMERIC,
    p_currency TEXT,
    p_status TEXT,
    p_attempt_number INTEGER DEFAULT 1,
    p_failure_code TEXT DEFAULT NULL,
    p_failure_message TEXT DEFAULT NULL,
    p_decline_code TEXT DEFAULT NULL,
    p_decline_reason TEXT DEFAULT NULL,
    p_next_retry_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO payment_attempts (
        member_id, invoice_id, invoice_number, amount, currency, status,
        attempt_number, failure_code, failure_message, decline_code, decline_reason,
        next_retry_at, succeeded_at, failed_at
    ) VALUES (
        p_member_id, p_invoice_id, p_invoice_number, p_amount, p_currency, p_status,
        p_attempt_number, p_failure_code, p_failure_message, p_decline_code, p_decline_reason,
        p_next_retry_at,
        CASE WHEN p_status = 'succeeded' THEN now() ELSE NULL END,
        CASE WHEN p_status = 'failed' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Function to update subscription status with history tracking
CREATE OR REPLACE FUNCTION public.update_subscription_status_with_history(
    p_member_id UUID,
    p_new_status TEXT,
    p_change_reason TEXT DEFAULT NULL,
    p_stripe_event_id TEXT DEFAULT NULL,
    p_changed_by TEXT DEFAULT 'system'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_status TEXT;
BEGIN
    -- Get current status
    SELECT status INTO v_old_status FROM members WHERE id = p_member_id;
    
    -- Only proceed if status is actually changing
    IF v_old_status IS DISTINCT FROM p_new_status THEN
        -- Log the status change
        INSERT INTO subscription_status_history (
            member_id, old_status, new_status, change_reason, stripe_event_id, changed_by
        ) VALUES (
            p_member_id, v_old_status, p_new_status, p_change_reason, p_stripe_event_id, p_changed_by
        );
        
        -- Update the member status
        UPDATE members SET status = p_new_status, updated_at = now() WHERE id = p_member_id;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Function to track payment method updates
CREATE OR REPLACE FUNCTION public.track_payment_method_update(
    p_member_id UUID,
    p_payment_method_id TEXT,
    p_event_type TEXT,
    p_card_last4 TEXT DEFAULT NULL,
    p_card_brand TEXT DEFAULT NULL,
    p_card_exp_month INTEGER DEFAULT NULL,
    p_card_exp_year INTEGER DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO payment_method_updates (
        member_id, payment_method_id, event_type, card_last4, card_brand,
        card_exp_month, card_exp_year, is_default
    ) VALUES (
        p_member_id, p_payment_method_id, p_event_type, p_card_last4, p_card_brand,
        p_card_exp_month, p_card_exp_year, p_is_default
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- ============================================
-- STEP 3: PAYMENT ANALYTICS FUNCTIONS (Second Migration)
-- ============================================

-- Function to get payment metrics for a date range
CREATE OR REPLACE FUNCTION public.get_payment_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_attempts', COUNT(*),
        'successful_payments', COUNT(*) FILTER (WHERE status = 'succeeded'),
        'failed_payments', COUNT(*) FILTER (WHERE status = 'failed'),
        'pending_payments', COUNT(*) FILTER (WHERE status = 'pending'),
        'total_collected', COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0),
        'total_failed_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'failed'), 0),
        'success_rate', CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE status = 'succeeded')::NUMERIC / COUNT(*) * 100), 2)
            ELSE 0 
        END,
        'average_payment_amount', COALESCE(ROUND(AVG(amount) FILTER (WHERE status = 'succeeded'), 2), 0),
        'retry_success_rate', CASE 
            WHEN COUNT(*) FILTER (WHERE attempt_number > 1) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1)::NUMERIC / 
                       COUNT(*) FILTER (WHERE attempt_number > 1) * 100), 2)
            ELSE 0
        END
    ) INTO v_result
    FROM payment_attempts
    WHERE created_at BETWEEN p_start_date AND p_end_date;
    
    RETURN v_result;
END;
$$;

-- Function to get subscription health metrics
CREATE OR REPLACE FUNCTION public.get_subscription_health()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_members', COUNT(*),
        'active_subscriptions', COUNT(*) FILTER (WHERE status = 'active'),
        'past_due_subscriptions', COUNT(*) FILTER (WHERE status = 'past_due'),
        'cancelled_subscriptions', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'frozen_subscriptions', COUNT(*) FILTER (WHERE status = 'frozen'),
        'pending_activation', COUNT(*) FILTER (WHERE status = 'pending_activation'),
        'churn_rate_30d', (
            SELECT ROUND((COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM members WHERE created_at < now() - interval '30 days'), 0) * 100), 2)
            FROM subscription_status_history
            WHERE new_status = 'cancelled'
            AND created_at > now() - interval '30 days'
        ),
        'at_risk_members', (
            SELECT COUNT(DISTINCT member_id)
            FROM payment_attempts
            WHERE status = 'failed'
            AND created_at > now() - interval '30 days'
        ),
        'members_with_expiring_cards', (
            SELECT COUNT(DISTINCT member_id)
            FROM payment_method_updates
            WHERE event_type = 'expiring_soon'
            AND created_at > now() - interval '30 days'
        )
    ) INTO v_result
    FROM members
    WHERE stripe_subscription_id IS NOT NULL;
    
    RETURN v_result;
END;
$$;

-- Function to get dunning efficiency metrics
CREATE OR REPLACE FUNCTION public.get_dunning_efficiency(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_failed_first_attempts', COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1),
        'recovered_on_retry', COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1),
        'recovery_rate', CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1)::NUMERIC / 
                       COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number = 1) * 100), 2)
            ELSE 0
        END,
        'average_attempts_to_success', COALESCE(
            ROUND(AVG(attempt_number) FILTER (WHERE status = 'succeeded' AND attempt_number > 1), 2), 0
        ),
        'top_decline_reasons', (
            SELECT json_agg(reason_data)
            FROM (
                SELECT json_build_object(
                    'reason', COALESCE(decline_reason, decline_code, 'unknown'),
                    'count', COUNT(*)
                ) as reason_data
                FROM payment_attempts
                WHERE status = 'failed'
                AND created_at BETWEEN p_start_date AND p_end_date
                GROUP BY COALESCE(decline_reason, decline_code, 'unknown')
                ORDER BY COUNT(*) DESC
                LIMIT 5
            ) top_reasons
        ),
        'amount_recovered', COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded' AND attempt_number > 1), 0),
        'amount_lost', COALESCE(
            SUM(amount) FILTER (WHERE status = 'failed' AND invoice_id NOT IN (
                SELECT invoice_id FROM payment_attempts WHERE status = 'succeeded'
            )), 0
        )
    ) INTO v_result
    FROM payment_attempts
    WHERE created_at BETWEEN p_start_date AND p_end_date;
    
    RETURN v_result;
END;
$$;

-- Function to get member payment history
CREATE OR REPLACE FUNCTION public.get_member_payment_history(
    p_member_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'payment_attempts', (
            SELECT json_agg(attempt_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'invoice_id', invoice_id,
                    'invoice_number', invoice_number,
                    'amount', amount,
                    'currency', currency,
                    'status', status,
                    'attempt_number', attempt_number,
                    'failure_message', failure_message,
                    'decline_reason', decline_reason,
                    'created_at', created_at,
                    'succeeded_at', succeeded_at,
                    'failed_at', failed_at
                ) as attempt_data,
                created_at
                FROM payment_attempts
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT p_limit
            ) attempts
        ),
        'status_history', (
            SELECT json_agg(history_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'old_status', old_status,
                    'new_status', new_status,
                    'change_reason', change_reason,
                    'changed_by', changed_by,
                    'created_at', created_at
                ) as history_data,
                created_at
                FROM subscription_status_history
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT 20
            ) history
        ),
        'payment_method_updates', (
            SELECT json_agg(pm_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', id,
                    'event_type', event_type,
                    'card_last4', card_last4,
                    'card_brand', card_brand,
                    'card_exp_month', card_exp_month,
                    'card_exp_year', card_exp_year,
                    'is_default', is_default,
                    'created_at', created_at
                ) as pm_data,
                created_at
                FROM payment_method_updates
                WHERE member_id = p_member_id
                ORDER BY created_at DESC
                LIMIT 20
            ) pm_updates
        ),
        'summary', (
            SELECT json_build_object(
                'total_payments', COUNT(*) FILTER (WHERE status = 'succeeded'),
                'total_amount_paid', COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0),
                'failed_payments', COUNT(*) FILTER (WHERE status = 'failed'),
                'last_successful_payment', MAX(succeeded_at)
            )
            FROM payment_attempts
            WHERE member_id = p_member_id
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.log_payment_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_status_with_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_payment_method_update TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_health TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dunning_efficiency TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_payment_history TO authenticated;