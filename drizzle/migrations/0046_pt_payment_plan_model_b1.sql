-- Phase 2C.5B1 — additive payment-plan model for PT packages.
-- Nothing is dropped: the legacy pt_packs columns and the legacy plan triplet stay in place
-- and are kept mirrored by the validation trigger.

ALTER TABLE public.pt_packs
  ADD COLUMN IF NOT EXISTS allow_pay_in_full BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_payment_plans BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.pt_packs.allow_payment_plan IS 'DEPRECATED (2C.5B1): replaced by public.pt_pack_payment_plans rows; kept for legacy compatibility.';
COMMENT ON COLUMN public.pt_packs.payment_plan_months IS 'DEPRECATED (2C.5B1): replaced by pt_pack_payment_plans.future_installment_count.';
COMMENT ON COLUMN public.pt_packs.payment_plan_stripe_price_id IS 'DEPRECATED (2C.5B1): replaced by pt_pack_payment_plans.stripe_price_id.';

ALTER TABLE public.pt_pack_payment_plans
  ADD COLUMN IF NOT EXISTS plan_total_cents INTEGER,
  ADD COLUMN IF NOT EXISTS amount_due_at_sale_cents INTEGER,
  ADD COLUMN IF NOT EXISTS future_installment_count INTEGER,
  ADD COLUMN IF NOT EXISTS final_installment_cents INTEGER,
  ADD COLUMN IF NOT EXISTS frequency_unit TEXT NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS frequency_interval INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_staff_first_autopay_date_selection BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID;

COMMENT ON COLUMN public.pt_pack_payment_plans.installment_count IS 'LEGACY MIRROR: future_installment_count + 1. Maintained by the validation trigger.';
COMMENT ON COLUMN public.pt_pack_payment_plans.down_payment_cents IS 'LEGACY MIRROR of amount_due_at_sale_cents. Maintained by the validation trigger.';

-- Backfill the canonical columns from the existing shape.
UPDATE public.pt_pack_payment_plans pl
SET plan_total_cents = COALESCE(pl.plan_total_cents, p.price_cents),
    amount_due_at_sale_cents = COALESCE(pl.amount_due_at_sale_cents, pl.down_payment_cents),
    future_installment_count = COALESCE(pl.future_installment_count, GREATEST(pl.installment_count - 1, 1)),
    final_installment_cents = COALESCE(pl.final_installment_cents, pl.installment_cents),
    frequency_unit = CASE pl.frequency WHEN 'weekly' THEN 'week' WHEN 'biweekly' THEN 'week' ELSE 'month' END,
    frequency_interval = CASE pl.frequency WHEN 'biweekly' THEN 2 ELSE 1 END
FROM public.pt_packs p
WHERE p.id = pl.pack_id;

ALTER TABLE public.pt_pack_payment_plans
  ADD CONSTRAINT pt_pack_payment_plans_freq_unit_chk CHECK (frequency_unit IN ('day','week','month','year')) NOT VALID,
  ADD CONSTRAINT pt_pack_payment_plans_freq_interval_chk CHECK (frequency_interval >= 1) NOT VALID;

-- Server-side validation + legacy mirroring. Rejects every invalid plan configuration.
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
    RAISE EXCEPTION 'Payment plan references a package that does not exist';
  END IF;

  -- Accept either the canonical fields or the legacy shape.
  NEW.plan_total_cents := COALESCE(NEW.plan_total_cents, v_price);
  NEW.amount_due_at_sale_cents := COALESCE(NEW.amount_due_at_sale_cents, NEW.down_payment_cents, 0);
  NEW.future_installment_count := COALESCE(NEW.future_installment_count, GREATEST(COALESCE(NEW.installment_count, 2) - 1, 1));
  NEW.installment_cents := COALESCE(NEW.installment_cents, 0);
  NEW.final_installment_cents := COALESCE(NEW.final_installment_cents, NEW.installment_cents);

  IF NEW.plan_total_cents <= 0 THEN
    RAISE EXCEPTION 'Plan total must be greater than zero';
  END IF;
  IF NEW.plan_total_cents <> v_price THEN
    RAISE EXCEPTION 'Plan total (%) must equal the package price (%)', NEW.plan_total_cents, v_price;
  END IF;
  IF NEW.future_installment_count < 1 THEN
    RAISE EXCEPTION 'A payment plan needs at least one future installment';
  END IF;
  IF NEW.amount_due_at_sale_cents < 0 OR NEW.installment_cents < 0 OR NEW.final_installment_cents < 0 THEN
    RAISE EXCEPTION 'Payment plan amounts cannot be negative';
  END IF;
  IF NEW.amount_due_at_sale_cents > NEW.plan_total_cents THEN
    RAISE EXCEPTION 'Amount due at sale cannot exceed the plan total';
  END IF;

  v_total := NEW.amount_due_at_sale_cents
           + (NEW.future_installment_count - 1) * NEW.installment_cents
           + NEW.final_installment_cents;
  IF v_total <> NEW.plan_total_cents THEN
    RAISE EXCEPTION 'Scheduled payments (%) must reconcile exactly to the plan total (%)', v_total, NEW.plan_total_cents;
  END IF;

  -- Keep the legacy columns mirrored so existing code keeps working during the transition.
  NEW.down_payment_cents := NEW.amount_due_at_sale_cents;
  NEW.installment_count := NEW.future_installment_count + 1;
  NEW.frequency_unit := CASE NEW.frequency WHEN 'weekly' THEN 'week' WHEN 'biweekly' THEN 'week' ELSE 'month' END;
  NEW.frequency_interval := CASE NEW.frequency WHEN 'biweekly' THEN 2 ELSE 1 END;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Carry any remaining legacy single-shape packages into the new model (idempotent).
INSERT INTO public.pt_pack_payment_plans
  (pack_id, name, installment_count, down_payment_cents, installment_cents,
   plan_total_cents, amount_due_at_sale_cents, future_installment_count, final_installment_cents,
   frequency, is_active, display_order, stripe_price_id)
SELECT
  p.id,
  p.payment_plan_months || ' Monthly Payments',
  p.payment_plan_months,
  p.price_cents - (p.payment_plan_months - 1) * CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  p.price_cents,
  p.price_cents - (p.payment_plan_months - 1) * CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  p.payment_plan_months - 1,
  CEIL(p.price_cents::numeric / p.payment_plan_months)::int,
  'monthly', true, 10, p.payment_plan_stripe_price_id
FROM public.pt_packs p
WHERE p.allow_payment_plan
  AND COALESCE(p.payment_plan_months, 0) >= 2
  AND NOT EXISTS (SELECT 1 FROM public.pt_pack_payment_plans x WHERE x.pack_id = p.id);
