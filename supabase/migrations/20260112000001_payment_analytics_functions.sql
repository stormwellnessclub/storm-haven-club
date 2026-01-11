-- =====================================================
-- Payment Analytics Functions
-- Functions for payment metrics, subscription health, and dunning efficiency
-- =====================================================

-- =====================================================
-- FUNCTION: get_payment_metrics
-- Returns payment metrics for a given time period
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_payment_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB;
  v_total_attempts INTEGER;
  v_successful_attempts INTEGER;
  v_failed_attempts INTEGER;
  v_pending_attempts INTEGER;
  v_requires_action_attempts INTEGER;
  v_total_amount DECIMAL(10,2);
  v_successful_amount DECIMAL(10,2);
  v_failed_amount DECIMAL(10,2);
  v_success_rate DECIMAL(5,2);
  v_failure_rate DECIMAL(5,2);
  v_unique_failed_members INTEGER;
  v_retry_success_rate DECIMAL(5,2);
BEGIN
  -- Total payment attempts
  SELECT COUNT(*)
  INTO v_total_attempts
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Successful attempts
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_successful_attempts, v_successful_amount
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'succeeded';

  -- Failed attempts
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_failed_attempts, v_failed_amount
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'failed';

  -- Pending attempts
  SELECT COUNT(*)
  INTO v_pending_attempts
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'pending';

  -- Requires action attempts
  SELECT COUNT(*)
  INTO v_requires_action_attempts
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'requires_action';

  -- Total amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_amount
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Success rate
  IF v_total_attempts > 0 THEN
    v_success_rate := (v_successful_attempts::DECIMAL / v_total_attempts::DECIMAL) * 100;
    v_failure_rate := (v_failed_attempts::DECIMAL / v_total_attempts::DECIMAL) * 100;
  ELSE
    v_success_rate := 0;
    v_failure_rate := 0;
  END IF;

  -- Unique members with failed payments
  SELECT COUNT(DISTINCT member_id)
  INTO v_unique_failed_members
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'failed';

  -- Retry success rate (attempts after first failure)
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number > 1)::DECIMAL / 
         COUNT(*) FILTER (WHERE attempt_number > 1)::DECIMAL) * 100
      ELSE 0
    END
  INTO v_retry_success_rate
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND attempt_number > 1;

  -- Build metrics object
  v_metrics := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'attempts', jsonb_build_object(
      'total', v_total_attempts,
      'successful', v_successful_attempts,
      'failed', v_failed_attempts,
      'pending', v_pending_attempts,
      'requires_action', v_requires_action_attempts
    ),
    'amounts', jsonb_build_object(
      'total', v_total_amount,
      'successful', v_successful_amount,
      'failed', v_failed_amount
    ),
    'rates', jsonb_build_object(
      'success_rate', ROUND(v_success_rate, 2),
      'failure_rate', ROUND(v_failure_rate, 2),
      'retry_success_rate', ROUND(v_retry_success_rate, 2)
    ),
    'members_affected', jsonb_build_object(
      'unique_failed_members', v_unique_failed_members
    )
  );

  RETURN v_metrics;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_payment_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_metrics TO anon;

-- =====================================================
-- FUNCTION: get_subscription_health
-- Returns subscription health metrics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_subscription_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health JSONB;
  v_total_active INTEGER;
  v_total_past_due INTEGER;
  v_total_cancelled INTEGER;
  v_recent_failures INTEGER;
  v_at_risk_count INTEGER;
  v_expiring_payment_methods INTEGER;
BEGIN
  -- Total active subscriptions
  SELECT COUNT(*)
  INTO v_total_active
  FROM public.members
  WHERE status = 'active'
    AND stripe_subscription_id IS NOT NULL;

  -- Total past due
  SELECT COUNT(*)
  INTO v_total_past_due
  FROM public.members
  WHERE status = 'past_due'
    AND stripe_subscription_id IS NOT NULL;

  -- Total cancelled (with subscription ID - recently cancelled)
  SELECT COUNT(*)
  INTO v_total_cancelled
  FROM public.members
  WHERE status = 'cancelled'
    AND stripe_subscription_id IS NOT NULL
    AND updated_at >= NOW() - INTERVAL '30 days';

  -- Recent failures (last 7 days)
  SELECT COUNT(DISTINCT member_id)
  INTO v_recent_failures
  FROM public.payment_attempts
  WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '7 days';

  -- At-risk members (multiple recent failures)
  SELECT COUNT(DISTINCT member_id)
  INTO v_at_risk_count
  FROM (
    SELECT member_id, COUNT(*) as failure_count
    FROM public.payment_attempts
    WHERE status = 'failed'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY member_id
    HAVING COUNT(*) >= 2
  ) at_risk;

  -- Members with expiring payment methods (expiring in next 30 days)
  -- Note: This requires payment_method_updates table to be populated
  SELECT COUNT(DISTINCT member_id)
  INTO v_expiring_payment_methods
  FROM public.payment_method_updates
  WHERE action IN ('expiring_soon', 'expired')
    AND card_exp_year IS NOT NULL
    AND card_exp_month IS NOT NULL
    AND (
      (card_exp_year::INTEGER = EXTRACT(YEAR FROM NOW())::INTEGER 
       AND card_exp_month::INTEGER <= EXTRACT(MONTH FROM NOW() + INTERVAL '1 month')::INTEGER)
      OR
      (card_exp_year::INTEGER = EXTRACT(YEAR FROM NOW() + INTERVAL '1 month')::INTEGER 
       AND card_exp_month::INTEGER <= EXTRACT(MONTH FROM NOW() + INTERVAL '1 month')::INTEGER)
    );

  -- Build health object
  v_health := jsonb_build_object(
    'subscriptions', jsonb_build_object(
      'active', v_total_active,
      'past_due', v_total_past_due,
      'recently_cancelled', v_total_cancelled,
      'total', v_total_active + v_total_past_due
    ),
    'payment_health', jsonb_build_object(
      'recent_failures_7d', v_recent_failures,
      'at_risk_members', v_at_risk_count,
      'expiring_payment_methods', v_expiring_payment_methods
    ),
    'health_score', CASE
      WHEN v_total_active + v_total_past_due = 0 THEN 0
      ELSE ROUND(
        (v_total_active::DECIMAL / (v_total_active + v_total_past_due)::DECIMAL) * 100, 
        2
      )
    END
  );

  RETURN v_health;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_subscription_health TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_health TO anon;

-- =====================================================
-- FUNCTION: get_dunning_efficiency
-- Returns dunning (payment retry) efficiency metrics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_dunning_efficiency(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_efficiency JSONB;
  v_first_attempt_success_rate DECIMAL(5,2);
  v_retry_attempt_count INTEGER;
  v_retry_success_count INTEGER;
  v_retry_success_rate DECIMAL(5,2);
  v_average_attempts_per_invoice DECIMAL(5,2);
  v_final_failure_rate DECIMAL(5,2);
  v_top_decline_reasons JSONB;
BEGIN
  -- First attempt success rate
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE status = 'succeeded' AND attempt_number = 1)::DECIMAL / 
         COUNT(*) FILTER (WHERE attempt_number = 1)::DECIMAL) * 100
      ELSE 0
    END
  INTO v_first_attempt_success_rate
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND attempt_number = 1;

  -- Retry attempts (attempts after first)
  SELECT COUNT(*)
  INTO v_retry_attempt_count
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND attempt_number > 1;

  -- Successful retries
  SELECT COUNT(*)
  INTO v_retry_success_count
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND attempt_number > 1
    AND status = 'succeeded';

  -- Retry success rate
  IF v_retry_attempt_count > 0 THEN
    v_retry_success_rate := (v_retry_success_count::DECIMAL / v_retry_attempt_count::DECIMAL) * 100;
  ELSE
    v_retry_success_rate := 0;
  END IF;

  -- Average attempts per invoice (for failed invoices)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT stripe_invoice_id) > 0 THEN
        COUNT(*)::DECIMAL / COUNT(DISTINCT stripe_invoice_id)::DECIMAL
      ELSE 0
    END
  INTO v_average_attempts_per_invoice
  FROM public.payment_attempts
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND stripe_invoice_id IN (
      SELECT DISTINCT stripe_invoice_id
      FROM public.payment_attempts
      WHERE created_at >= p_start_date
        AND created_at <= p_end_date
        AND status = 'failed'
    );

  -- Final failure rate (invoices that eventually failed after all retries)
  WITH invoice_final_status AS (
    SELECT 
      stripe_invoice_id,
      status,
      ROW_NUMBER() OVER (PARTITION BY stripe_invoice_id ORDER BY attempt_number DESC) as rn
    FROM public.payment_attempts
    WHERE created_at >= p_start_date
      AND created_at <= p_end_date
      AND stripe_invoice_id IS NOT NULL
  )
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE status = 'failed')::DECIMAL / COUNT(*)::DECIMAL) * 100
      ELSE 0
    END
  INTO v_final_failure_rate
  FROM invoice_final_status
  WHERE rn = 1;

  -- Top decline reasons
  SELECT jsonb_agg(
    jsonb_build_object(
      'decline_code', decline_code,
      'decline_reason', decline_reason,
      'count', decline_count
    )
    ORDER BY decline_count DESC
  )
  INTO v_top_decline_reasons
  FROM (
    SELECT 
      COALESCE(decline_code, 'unknown') as decline_code,
      COALESCE(decline_reason, 'Unknown reason') as decline_reason,
      COUNT(*) as decline_count
    FROM public.payment_attempts
    WHERE created_at >= p_start_date
      AND created_at <= p_end_date
      AND status = 'failed'
      AND decline_code IS NOT NULL
    GROUP BY decline_code, decline_reason
    ORDER BY decline_count DESC
    LIMIT 10
  ) top_reasons;

  -- Build efficiency object
  v_efficiency := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'first_attempt', jsonb_build_object(
      'success_rate', ROUND(v_first_attempt_success_rate, 2)
    ),
    'retries', jsonb_build_object(
      'total_attempts', v_retry_attempt_count,
      'successful', v_retry_success_count,
      'success_rate', ROUND(v_retry_success_rate, 2),
      'average_attempts_per_invoice', ROUND(v_average_attempts_per_invoice, 2)
    ),
    'final_outcomes', jsonb_build_object(
      'final_failure_rate', ROUND(v_final_failure_rate, 2)
    ),
    'top_decline_reasons', COALESCE(v_top_decline_reasons, '[]'::jsonb)
  );

  RETURN v_efficiency;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_dunning_efficiency TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dunning_efficiency TO anon;

-- =====================================================
-- FUNCTION: get_member_payment_history
-- Returns payment history for a specific member
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_member_payment_history(
  p_member_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'invoice_id', stripe_invoice_id,
      'invoice_number', invoice_number,
      'amount', amount,
      'currency', currency,
      'status', status,
      'attempt_number', attempt_number,
      'failure_code', failure_code,
      'failure_message', failure_message,
      'decline_code', decline_code,
      'decline_reason', decline_reason,
      'created_at', created_at,
      'succeeded_at', succeeded_at,
      'failed_at', failed_at,
      'next_retry_at', next_retry_at
    )
    ORDER BY created_at DESC
  )
  INTO v_history
  FROM public.payment_attempts
  WHERE member_id = p_member_id
  ORDER BY created_at DESC
  LIMIT p_limit;

  RETURN COALESCE(v_history, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_member_payment_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_payment_history TO anon;

-- =====================================================
-- Add comments for documentation
-- =====================================================
COMMENT ON FUNCTION public.get_payment_metrics IS 'Returns payment metrics for a given time period';
COMMENT ON FUNCTION public.get_subscription_health IS 'Returns subscription health metrics';
COMMENT ON FUNCTION public.get_dunning_efficiency IS 'Returns dunning (payment retry) efficiency metrics';
COMMENT ON FUNCTION public.get_member_payment_history IS 'Returns payment history for a specific member';
