CREATE OR REPLACE FUNCTION public.pt_promo_plans(p_promo text)
 RETURNS TABLE(id uuid, pack_id uuid, installment_count integer, amount_due_at_sale_cents integer, installment_cents integer, final_installment_cents integer, plan_total_cents integer, session_release integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pl.id, pl.pack_id, pl.future_installment_count + 1, pl.amount_due_at_sale_cents, pl.installment_cents,
         pl.final_installment_cents, pl.plan_total_cents, pl.session_release
  FROM public.pt_pack_payment_plans pl JOIN public.pt_packs p ON p.id = pl.pack_id
  WHERE p.promo_key = p_promo AND p.is_active AND pl.is_active;
$function$;