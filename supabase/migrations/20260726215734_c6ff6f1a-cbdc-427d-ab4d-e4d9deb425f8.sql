-- 1. Extend pt_packs with payment-plan config (admin-only fields)
ALTER TABLE public.pt_packs
  ADD COLUMN IF NOT EXISTS allow_payment_plan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_plan_months integer,
  ADD COLUMN IF NOT EXISTS payment_plan_stripe_price_id text;

-- 2. Extend pt_passes to track plan state on sold passes
ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS payment_plan_subscription_id text,
  ADD COLUMN IF NOT EXISTS payment_plan_total_installments integer,
  ADD COLUMN IF NOT EXISTS payment_plan_installments_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_plan_status text NOT NULL DEFAULT 'none'
    CHECK (payment_plan_status IN ('none','active','completed','past_due','cancelled'));

CREATE INDEX IF NOT EXISTS idx_pt_passes_payment_plan_sub
  ON public.pt_passes(payment_plan_subscription_id)
  WHERE payment_plan_subscription_id IS NOT NULL;

-- 3. Safe delete RPC — soft-archive if any pass references the pack,
--    otherwise hard delete.
CREATE OR REPLACE FUNCTION public.delete_pt_pack(p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack RECORD;
  v_ref_count integer;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_pack FROM public.pt_packs WHERE id = p_pack_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pack not found';
  END IF;

  SELECT count(*) INTO v_ref_count
  FROM public.pt_passes
  WHERE pack_id = p_pack_id;

  IF v_ref_count > 0 THEN
    UPDATE public.pt_packs
       SET is_active  = false,
           is_public  = false,
           name       = CASE
                          WHEN name LIKE '[Archived]%' THEN name
                          ELSE '[Archived] ' || name
                        END,
           updated_at = now()
     WHERE id = p_pack_id;
    RETURN jsonb_build_object('deleted', false, 'archived', true, 'passes', v_ref_count);
  ELSE
    DELETE FROM public.pt_packs WHERE id = p_pack_id;
    RETURN jsonb_build_object('deleted', true, 'archived', false, 'passes', 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_pt_pack(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_pt_pack(uuid) TO authenticated;