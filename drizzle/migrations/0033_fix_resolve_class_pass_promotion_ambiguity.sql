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
    SELECT pr.* INTO p FROM public.promotions pr
      WHERE UPPER(pr.promo_code) = UPPER(trim(_code))
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

  SELECT pr.* INTO p FROM public.promotions pr
    WHERE pr.status = 'active'
      AND pr.auto_apply = true
      AND pr.promo_code IS NULL
      AND now() BETWEEN pr.starts_at AND pr.ends_at
      AND (pr.applies_to_all OR _pricing_id = ANY(pr.pricing_ids))
      AND (pr.max_redemptions IS NULL OR pr.redemption_count < pr.max_redemptions)
    ORDER BY CASE WHEN pr.discount_type = 'percent' THEN pr.discount_value ELSE 0 END DESC,
             pr.discount_value DESC
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