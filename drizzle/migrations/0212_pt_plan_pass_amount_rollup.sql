CREATE OR REPLACE FUNCTION public.pt_rollup_plan_pass_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_pass uuid := COALESCE(NEW.pass_id, OLD.pass_id);
BEGIN
  UPDATE public.pt_passes p SET
    amount_paid_cents = agg.paid_cents,
    amount_outstanding_cents = GREATEST(agg.total_cents - agg.paid_cents, 0),
    updated_at = now()
  FROM (
    SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid_cents,
           COALESCE(SUM(amount_cents), 0) AS total_cents
      FROM public.pt_payment_plan_installments WHERE pass_id = v_pass
  ) agg
  WHERE p.id = v_pass
    AND (p.amount_paid_cents IS DISTINCT FROM agg.paid_cents
      OR p.amount_outstanding_cents IS DISTINCT FROM GREATEST(agg.total_cents - agg.paid_cents, 0));
  RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION public.pt_rollup_plan_pass_amounts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pt_rollup_plan_pass_amounts_trg ON public.pt_payment_plan_installments;
CREATE TRIGGER pt_rollup_plan_pass_amounts_trg
AFTER INSERT OR DELETE OR UPDATE OF status, amount_cents ON public.pt_payment_plan_installments
FOR EACH ROW EXECUTE FUNCTION public.pt_rollup_plan_pass_amounts();

-- Correct any package whose totals disagree with its payment rows (Maysa's owner-deal package).
UPDATE public.pt_passes p SET
  amount_paid_cents = agg.paid_cents,
  amount_outstanding_cents = GREATEST(agg.total_cents - agg.paid_cents, 0),
  updated_at = now()
FROM (
  SELECT pass_id,
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid_cents,
         COALESCE(SUM(amount_cents), 0) AS total_cents
    FROM public.pt_payment_plan_installments GROUP BY pass_id
) agg
WHERE p.id = agg.pass_id
  AND (p.amount_paid_cents IS DISTINCT FROM agg.paid_cents
    OR p.amount_outstanding_cents IS DISTINCT FROM GREATEST(agg.total_cents - agg.paid_cents, 0));