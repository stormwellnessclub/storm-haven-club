-- Named payment plans per PT package (replaces the single allow_payment_plan/payment_plan_months shape)
CREATE TABLE IF NOT EXISTS public.pt_pack_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.pt_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  installment_count INTEGER NOT NULL DEFAULT 4,
  down_payment_cents INTEGER NOT NULL DEFAULT 0,
  installment_cents INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 10,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pt_pack_payment_plans_count_chk CHECK (installment_count BETWEEN 2 AND 24),
  CONSTRAINT pt_pack_payment_plans_freq_chk CHECK (frequency IN ('monthly','weekly','biweekly')),
  CONSTRAINT pt_pack_payment_plans_amounts_chk CHECK (down_payment_cents >= 0 AND installment_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pt_pack_payment_plans_pack ON public.pt_pack_payment_plans(pack_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_pack_payment_plans TO authenticated;
GRANT SELECT ON public.pt_pack_payment_plans TO anon;
GRANT ALL ON public.pt_pack_payment_plans TO service_role;

ALTER TABLE public.pt_pack_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans on public packs"
  ON public.pt_pack_payment_plans FOR SELECT
  USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.pt_packs p
      WHERE p.id = pack_id AND p.is_public AND p.is_active
    )
  );

CREATE POLICY "Staff can view all PT payment plans"
  ON public.pt_pack_payment_plans FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE POLICY "Staff can manage PT payment plans"
  ON public.pt_pack_payment_plans FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- Keep updated_at fresh and validate the plan adds up to the package price.
CREATE OR REPLACE FUNCTION public.pt_pack_payment_plan_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price INTEGER;
  v_total INTEGER;
BEGIN
  SELECT price_cents INTO v_price FROM public.pt_packs WHERE id = NEW.pack_id;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;
  v_total := NEW.down_payment_cents + (NEW.installment_count - 1) * NEW.installment_cents;
  IF v_total <> v_price THEN
    RAISE EXCEPTION 'Plan total (%) must equal the package price (%)', v_total, v_price;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pt_pack_payment_plan_validate_trg
  BEFORE INSERT OR UPDATE ON public.pt_pack_payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.pt_pack_payment_plan_validate();

-- Carry existing single-shape plans over into one named plan each.
INSERT INTO public.pt_pack_payment_plans
  (pack_id, name, installment_count, down_payment_cents, installment_cents, frequency, is_active, display_order, stripe_price_id)
SELECT
  p.id,
  p.payment_plan_months || ' Monthly Payments',
  p.payment_plan_months,
  p.price_cents - (p.payment_plan_months - 1) * CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  'monthly',
  true,
  10,
  p.payment_plan_stripe_price_id
FROM public.pt_packs p
WHERE p.allow_payment_plan IS TRUE
  AND p.payment_plan_months IS NOT NULL
  AND p.payment_plan_months >= 2
  AND NOT EXISTS (SELECT 1 FROM public.pt_pack_payment_plans e WHERE e.pack_id = p.id);

COMMENT ON COLUMN public.pt_packs.allow_payment_plan IS 'DEPRECATED: replaced by public.pt_pack_payment_plans';
COMMENT ON COLUMN public.pt_packs.payment_plan_months IS 'DEPRECATED: replaced by public.pt_pack_payment_plans.installment_count';
COMMENT ON COLUMN public.pt_packs.payment_plan_stripe_price_id IS 'DEPRECATED: replaced by public.pt_pack_payment_plans.stripe_price_id';
