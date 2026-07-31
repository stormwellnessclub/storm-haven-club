CREATE OR REPLACE FUNCTION public.increment_promotion_redemption(_promotion_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.promotions
     SET redemption_count = redemption_count + 1
   WHERE id = _promotion_id;
$$;

REVOKE ALL ON FUNCTION public.increment_promotion_redemption(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_promotion_redemption(UUID) TO service_role;