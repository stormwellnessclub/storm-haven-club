-- =========================
-- PROMOTIONS
-- =========================
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- scope
  scope_type TEXT NOT NULL DEFAULT 'class_pass',
  applies_to_all BOOLEAN NOT NULL DEFAULT true,
  pricing_ids UUID[] NOT NULL DEFAULT '{}',
  -- discount
  discount_type TEXT NOT NULL,             -- 'percent' | 'fixed'
  discount_value NUMERIC NOT NULL,         -- percent (0-100) or dollars
  -- window
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  -- behavior
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  promo_code TEXT,
  max_redemptions INTEGER,
  once_per_customer BOOLEAN NOT NULL DEFAULT true,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  -- lifecycle
  status TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'active' | 'cancelled'
  stripe_coupon_id TEXT,
  stripe_promotion_code_id TEXT,
  -- reminders
  remind_on_launch BOOLEAN NOT NULL DEFAULT false,
  remind_3_days_before_end BOOLEAN NOT NULL DEFAULT false,
  remind_last_day BOOLEAN NOT NULL DEFAULT false,
  default_audience TEXT NOT NULL DEFAULT 'members_and_nonmembers',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotions_discount_type_check CHECK (discount_type IN ('percent','fixed')),
  CONSTRAINT promotions_status_check CHECK (status IN ('draft','active','cancelled')),
  CONSTRAINT promotions_scope_check CHECK (scope_type IN ('class_pass')),
  CONSTRAINT promotions_discount_value_check CHECK (discount_value > 0)
);

CREATE UNIQUE INDEX promotions_promo_code_key
  ON public.promotions (UPPER(promo_code)) WHERE promo_code IS NOT NULL;
CREATE INDEX promotions_window_idx ON public.promotions (starts_at, ends_at) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promotions"
  ON public.promotions FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

CREATE POLICY "Public can view live automatic sales"
  ON public.promotions FOR SELECT
  USING (
    status = 'active'
    AND auto_apply = true
    AND promo_code IS NULL
    AND now() >= starts_at
    AND now() <= ends_at
  );

-- =========================
-- REDEMPTIONS
-- =========================
CREATE TABLE public.promotion_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  pricing_id UUID,
  original_cents INTEGER,
  discount_cents INTEGER,
  final_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX promotion_redemptions_promo_idx ON public.promotion_redemptions (promotion_id);

GRANT SELECT ON public.promotion_redemptions TO authenticated;
GRANT ALL ON public.promotion_redemptions TO service_role;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view redemptions"
  ON public.promotion_redemptions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- =========================
-- EMAIL JOBS
-- =========================
CREATE TABLE public.promotion_email_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                       -- 'launch' | 'ending_soon' | 'last_day' | 'manual'
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'members_and_nonmembers',
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'sending' | 'sent' | 'cancelled' | 'failed'
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotion_email_jobs_kind_check CHECK (kind IN ('launch','ending_soon','last_day','manual')),
  CONSTRAINT promotion_email_jobs_status_check CHECK (status IN ('pending','sending','sent','cancelled','failed'))
);

CREATE INDEX promotion_email_jobs_due_idx ON public.promotion_email_jobs (scheduled_for) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_email_jobs TO authenticated;
GRANT ALL ON public.promotion_email_jobs TO service_role;
ALTER TABLE public.promotion_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promotion email jobs"
  ON public.promotion_email_jobs FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- updated_at triggers
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotion_email_jobs_updated_at
  BEFORE UPDATE ON public.promotion_email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- RESOLVER
-- =========================
CREATE OR REPLACE FUNCTION public.resolve_class_pass_promotion(
  _pricing_id UUID,
  _code TEXT DEFAULT NULL
)
RETURNS TABLE (
  promotion_id UUID,
  name TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  promo_code TEXT,
  reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  IF _code IS NOT NULL AND length(trim(_code)) > 0 THEN
    SELECT * INTO p FROM public.promotions
      WHERE UPPER(promo_code) = UPPER(trim(_code))
      LIMIT 1;

    IF p.id IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'invalid_code'::text;
      RETURN;
    END IF;
    IF p.status <> 'active' THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'not_active'::text;
      RETURN;
    END IF;
    IF now() < p.starts_at THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'not_started'::text;
      RETURN;
    END IF;
    IF now() > p.ends_at THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'expired'::text;
      RETURN;
    END IF;
    IF NOT (p.applies_to_all OR _pricing_id = ANY(p.pricing_ids)) THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'not_applicable'::text;
      RETURN;
    END IF;
    IF p.max_redemptions IS NOT NULL AND p.redemption_count >= p.max_redemptions THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'limit_reached'::text;
      RETURN;
    END IF;

    RETURN QUERY SELECT p.id, p.name, p.discount_type, p.discount_value, p.promo_code, 'ok'::text;
    RETURN;
  END IF;

  -- automatic sale: pick the biggest discount available
  SELECT * INTO p FROM public.promotions
    WHERE status = 'active'
      AND auto_apply = true
      AND promo_code IS NULL
      AND now() BETWEEN starts_at AND ends_at
      AND (applies_to_all OR _pricing_id = ANY(pricing_ids))
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    ORDER BY CASE WHEN discount_type = 'percent' THEN discount_value ELSE 0 END DESC,
             discount_value DESC
    LIMIT 1;

  IF p.id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, 'none'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT p.id, p.name, p.discount_type, p.discount_value, p.promo_code, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_class_pass_promotion(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_class_pass_promotion(UUID, TEXT) TO anon, authenticated, service_role;