ALTER TABLE public.pt_packs
  ADD COLUMN IF NOT EXISTS promo_key text,
  ADD COLUMN IF NOT EXISTS promo_audience text CHECK (promo_audience IN ('member','non_member')),
  ADD COLUMN IF NOT EXISTS sale_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz;

INSERT INTO public.pt_packs (format, name, sessions, price_cents, expiration_days, is_public, is_active, display_order, notes, allow_pay_in_full, promo_key, promo_audience, sale_starts_at, sale_ends_at)
SELECT 'semi_private', 'Black Friday Semi-Private ' || s || ' Sessions (' || CASE a WHEN 'member' THEN 'Member' ELSE 'Non-Member' END || ')',
  s, p, e, false, true, 900 + s, 'Black Friday 2026 sale package', true, 'black_friday_2026', a,
  now(), timestamptz '2026-11-30 23:59:59 America/Detroit'
FROM (VALUES
 ('member',10,52000,60),('member',20,104000,90),('member',30,156000,120),('member',40,188000,160),('member',60,282000,180),('member',80,336000,279),
 ('non_member',10,58000,60),('non_member',20,116000,90),('non_member',30,174000,120),('non_member',40,212000,160),('non_member',60,315000,180),('non_member',80,380000,279)
) v(a,s,p,e);

-- Who counts as a member for promo pricing (cancelled = non-member).
CREATE OR REPLACE FUNCTION public.pt_promo_is_member(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m
    WHERE m.user_id = p_user AND m.status IN ('active','past_due','frozen'));
$$;
REVOKE ALL ON FUNCTION public.pt_promo_is_member(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_promo_is_member(uuid) TO service_role;

-- Sale packages currently on sale (public listing).
CREATE OR REPLACE FUNCTION public.pt_promo_packs(p_promo text)
RETURNS TABLE(id uuid, name text, sessions int, price_cents int, promo_audience text, sale_ends_at timestamptz, expiration_days int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, sessions, price_cents, promo_audience, sale_ends_at, expiration_days
  FROM public.pt_packs
  WHERE promo_key = p_promo AND is_active
    AND (sale_starts_at IS NULL OR sale_starts_at <= now())
  ORDER BY promo_audience, sessions;
$$;
GRANT EXECUTE ON FUNCTION public.pt_promo_packs(text) TO anon, authenticated;

-- Which price list a signed-in viewer gets.
CREATE OR REPLACE FUNCTION public.pt_promo_my_audience()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL
    WHEN public.pt_promo_is_member(auth.uid()) THEN 'member' ELSE 'non_member' END;
$$;
GRANT EXECUTE ON FUNCTION public.pt_promo_my_audience() TO authenticated;