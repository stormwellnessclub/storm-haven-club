ALTER TABLE public.pt_packs ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;
DROP FUNCTION IF EXISTS public.pt_promo_packs(text);
CREATE FUNCTION public.pt_promo_packs(p_promo text)
 RETURNS TABLE(id uuid, name text, sessions integer, price_cents integer, promo_audience text, sale_ends_at timestamp with time zone, expiration_days integer, sold_out boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, name, sessions, price_cents, promo_audience, sale_ends_at, expiration_days, sold_out
  FROM public.pt_packs
  WHERE promo_key = p_promo AND is_active
    AND (sale_starts_at IS NULL OR sale_starts_at <= now())
  ORDER BY promo_audience, sessions;
$function$;
GRANT EXECUTE ON FUNCTION public.pt_promo_packs(text) TO anon, authenticated, service_role;