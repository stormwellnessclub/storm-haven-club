-- 1) Class passes: accounts could insert their own active passes with any balance.
--    Passes are created by paid checkout (server code), staff grants and staff sales.
DROP POLICY IF EXISTS "Users can purchase passes" ON public.class_passes;

-- 2) Café prices: front desk could change prices that the register charges.
CREATE OR REPLACE FUNCTION public.guard_cafe_price_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.price IS DISTINCT FROM OLD.price THEN
    RAISE EXCEPTION 'Only a manager or admin can set café prices' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_cafe_price_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cafe_menu_items_price_guard ON public.cafe_menu_items;
CREATE TRIGGER trg_cafe_menu_items_price_guard
  BEFORE INSERT OR UPDATE ON public.cafe_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_cafe_price_changes();

DROP TRIGGER IF EXISTS trg_cafe_menu_addons_price_guard ON public.cafe_menu_addons;
CREATE TRIGGER trg_cafe_menu_addons_price_guard
  BEFORE INSERT OR UPDATE ON public.cafe_menu_addons
  FOR EACH ROW EXECUTE FUNCTION public.guard_cafe_price_changes();

-- 3) Gift class packs: claiming needs the private code from the gift email.
CREATE TABLE IF NOT EXISTS public.gift_pass_claim_tokens (
  pass_id uuid PRIMARY KEY REFERENCES public.class_passes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gift_pass_claim_tokens TO service_role;
ALTER TABLE public.gift_pass_claim_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only server code (service role) and the claim function read it.

DROP FUNCTION IF EXISTS public.claim_mothers_day_pack(text);

CREATE OR REPLACE FUNCTION public.claim_mothers_day_pack(_email text, _code text)
RETURNS TABLE(claimed_count integer, pass_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_jwt_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_target_email text := lower(btrim(coalesce(_email, '')));
  v_code text := btrim(coalesce(_code, ''));
  v_pass uuid;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_target_email = '' OR v_target_email <> v_jwt_email THEN
    RAISE EXCEPTION 'email mismatch';
  END IF;
  IF length(v_code) < 32 THEN
    RAISE EXCEPTION 'Please open the claim link from your gift email';
  END IF;

  SELECT t.pass_id INTO v_pass
    FROM public.gift_pass_claim_tokens t
    JOIN public.class_passes cp ON cp.id = t.pass_id
   WHERE t.token = v_code
     AND cp.promo_code = 'mothers_day_2026'
     AND lower(cp.gift_recipient_email) = v_target_email;

  IF v_pass IS NULL THEN
    RAISE EXCEPTION 'This claim link is not valid for this account';
  END IF;

  SELECT id INTO v_member_id FROM public.members
    WHERE user_id = v_uid AND status = 'active' LIMIT 1;

  UPDATE public.class_passes
     SET user_id = v_uid,
         member_id = COALESCE(member_id, v_member_id),
         gift_verification_status = CASE WHEN v_member_id IS NOT NULL THEN 'auto' ELSE gift_verification_status END,
         updated_at = now()
   WHERE id = v_pass AND user_id IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, ARRAY[]::uuid[];
    RETURN;
  END IF;

  DELETE FROM public.gift_pass_claim_tokens WHERE pass_id = v_pass;
  RETURN QUERY SELECT 1, ARRAY[v_pass];
END;
$$;
REVOKE ALL ON FUNCTION public.claim_mothers_day_pack(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_mothers_day_pack(text, text) TO authenticated, service_role;