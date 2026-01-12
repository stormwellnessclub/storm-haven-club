-- Create payment_attempts table to track all payment transactions
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  invoice_id TEXT,
  invoice_number TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending', 'requires_action')),
  attempt_number INTEGER DEFAULT 1,
  failure_code TEXT,
  failure_message TEXT,
  decline_code TEXT,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

-- Enable RLS on payment_attempts
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view all payment attempts
CREATE POLICY "Staff can view all payment attempts"
ON public.payment_attempts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  )
);

-- RLS: Members can view their own payment history
CREATE POLICY "Members can view own payment history"
ON public.payment_attempts
FOR SELECT
USING (
  member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  )
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_attempts_member_id ON public.payment_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON public.payment_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice_id ON public.payment_attempts(invoice_id);

-- Function 1: get_payment_metrics - Returns payment analytics for a date range
CREATE OR REPLACE FUNCTION public.get_payment_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_attempts INTEGER;
  successful_attempts INTEGER;
  failed_attempts INTEGER;
  pending_attempts INTEGER;
  requires_action_attempts INTEGER;
  total_amount DECIMAL(10,2);
  successful_amount DECIMAL(10,2);
  failed_amount DECIMAL(10,2);
  unique_failed_members INTEGER;
BEGIN
  -- Check if user is staff
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get counts by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'requires_action')
  INTO total_attempts, successful_attempts, failed_attempts, pending_attempts, requires_action_attempts
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  -- Get amounts by status
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0),
    COALESCE(SUM(amount) FILTER (WHERE status = 'failed'), 0)
  INTO total_amount, successful_amount, failed_amount
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  -- Get unique members with failures
  SELECT COUNT(DISTINCT member_id)
  INTO unique_failed_members
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date
  AND status = 'failed';

  result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'attempts', jsonb_build_object(
      'total', COALESCE(total_attempts, 0),
      'successful', COALESCE(successful_attempts, 0),
      'failed', COALESCE(failed_attempts, 0),
      'pending', COALESCE(pending_attempts, 0),
      'requires_action', COALESCE(requires_action_attempts, 0)
    ),
    'amounts', jsonb_build_object(
      'total', total_amount,
      'successful', successful_amount,
      'failed', failed_amount
    ),
    'rates', jsonb_build_object(
      'success_rate', CASE WHEN total_attempts > 0 THEN ROUND((successful_attempts::DECIMAL / total_attempts) * 100, 2) ELSE 0 END,
      'failure_rate', CASE WHEN total_attempts > 0 THEN ROUND((failed_attempts::DECIMAL / total_attempts) * 100, 2) ELSE 0 END,
      'retry_success_rate', 0
    ),
    'members_affected', jsonb_build_object(
      'unique_failed_members', COALESCE(unique_failed_members, 0)
    )
  );

  RETURN result;
END;
$$;

-- Function 2: get_subscription_health - Returns subscription health metrics
CREATE OR REPLACE FUNCTION public.get_subscription_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  active_count INTEGER;
  past_due_count INTEGER;
  cancelled_count INTEGER;
  total_count INTEGER;
  recent_failures INTEGER;
  at_risk_count INTEGER;
  health_score DECIMAL(5,2);
BEGIN
  -- Check if user is staff
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Count subscriptions by status
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'past_due'),
    COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired') AND updated_at > NOW() - INTERVAL '30 days'),
    COUNT(*)
  INTO active_count, past_due_count, cancelled_count, total_count
  FROM public.members
  WHERE stripe_subscription_id IS NOT NULL;

  -- Count recent payment failures (last 7 days)
  SELECT COUNT(*)
  INTO recent_failures
  FROM public.payment_attempts
  WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days';

  -- Count at-risk members (multiple failures in last 30 days)
  SELECT COUNT(DISTINCT member_id)
  INTO at_risk_count
  FROM public.payment_attempts
  WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY member_id
  HAVING COUNT(*) >= 2;

  -- Calculate health score (100 - weighted penalties)
  health_score := 100.0;
  IF total_count > 0 THEN
    health_score := health_score - (past_due_count::DECIMAL / total_count * 30);
    health_score := health_score - (COALESCE(at_risk_count, 0)::DECIMAL / total_count * 20);
  END IF;
  health_score := GREATEST(0, health_score);

  result := jsonb_build_object(
    'subscriptions', jsonb_build_object(
      'active', COALESCE(active_count, 0),
      'past_due', COALESCE(past_due_count, 0),
      'recently_cancelled', COALESCE(cancelled_count, 0),
      'total', COALESCE(total_count, 0)
    ),
    'payment_health', jsonb_build_object(
      'recent_failures_7d', COALESCE(recent_failures, 0),
      'at_risk_members', COALESCE(at_risk_count, 0),
      'expiring_payment_methods', 0
    ),
    'health_score', ROUND(health_score, 1)
  );

  RETURN result;
END;
$$;

-- Function 3: get_dunning_efficiency - Returns dunning/retry analytics
CREATE OR REPLACE FUNCTION public.get_dunning_efficiency(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  first_attempt_success DECIMAL(5,2);
  retry_total INTEGER;
  retry_successful INTEGER;
  retry_rate DECIMAL(5,2);
  avg_attempts DECIMAL(5,2);
  final_failure_rate DECIMAL(5,2);
  decline_reasons JSONB;
BEGIN
  -- Check if user is staff
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- First attempt success rate
  SELECT 
    CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'succeeded')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END
  INTO first_attempt_success
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date
  AND attempt_number = 1;

  -- Retry statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'succeeded')
  INTO retry_total, retry_successful
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date
  AND attempt_number > 1;

  retry_rate := CASE WHEN retry_total > 0 THEN ROUND((retry_successful::DECIMAL / retry_total) * 100, 2) ELSE 0 END;

  -- Average attempts per invoice
  SELECT COALESCE(AVG(attempt_number), 1)
  INTO avg_attempts
  FROM public.payment_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  -- Final failure rate (invoices that never succeeded)
  WITH invoice_outcomes AS (
    SELECT 
      invoice_id,
      bool_or(status = 'succeeded') as ever_succeeded
    FROM public.payment_attempts
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND invoice_id IS NOT NULL
    GROUP BY invoice_id
  )
  SELECT 
    CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE NOT ever_succeeded)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END
  INTO final_failure_rate
  FROM invoice_outcomes;

  -- Top decline reasons
  SELECT COALESCE(jsonb_agg(reason_data), '[]'::jsonb)
  INTO decline_reasons
  FROM (
    SELECT jsonb_build_object(
      'decline_code', COALESCE(decline_code, 'unknown'),
      'decline_reason', COALESCE(decline_reason, 'Unknown reason'),
      'count', COUNT(*)
    ) as reason_data
    FROM public.payment_attempts
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND status = 'failed'
    GROUP BY decline_code, decline_reason
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) top_reasons;

  result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'first_attempt', jsonb_build_object(
      'success_rate', first_attempt_success
    ),
    'retries', jsonb_build_object(
      'total_attempts', COALESCE(retry_total, 0),
      'successful', COALESCE(retry_successful, 0),
      'success_rate', retry_rate,
      'average_attempts_per_invoice', ROUND(avg_attempts, 2)
    ),
    'final_outcomes', jsonb_build_object(
      'final_failure_rate', COALESCE(final_failure_rate, 0)
    ),
    'top_decline_reasons', decline_reasons
  );

  RETURN result;
END;
$$;

-- Function 4: get_member_payment_history - Returns payment history for a specific member
CREATE OR REPLACE FUNCTION public.get_member_payment_history(
  p_member_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  is_own_member BOOLEAN;
  is_staff BOOLEAN;
BEGIN
  -- Check if user is accessing their own data
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = p_member_id AND user_id = auth.uid()
  ) INTO is_own_member;

  -- Check if user is staff
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ) INTO is_staff;

  IF NOT is_own_member AND NOT is_staff THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pa.id,
      'invoice_id', pa.invoice_id,
      'invoice_number', pa.invoice_number,
      'amount', pa.amount,
      'currency', pa.currency,
      'status', pa.status,
      'attempt_number', pa.attempt_number,
      'failure_code', pa.failure_code,
      'failure_message', pa.failure_message,
      'decline_code', pa.decline_code,
      'decline_reason', pa.decline_reason,
      'created_at', pa.created_at,
      'succeeded_at', pa.succeeded_at,
      'failed_at', pa.failed_at,
      'next_retry_at', pa.next_retry_at
    ) ORDER BY pa.created_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM public.payment_attempts pa
  WHERE pa.member_id = p_member_id
  LIMIT p_limit;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_payment_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dunning_efficiency(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_payment_history(UUID, INTEGER) TO authenticated;