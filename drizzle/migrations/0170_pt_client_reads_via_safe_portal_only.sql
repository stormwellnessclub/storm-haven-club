DROP POLICY IF EXISTS "Members view own PT appointments" ON public.pt_appointments;
DROP POLICY IF EXISTS "Members cancel own PT appointments" ON public.pt_appointments;
DROP POLICY IF EXISTS "Members view own PT passes" ON public.pt_passes;
DROP POLICY IF EXISTS "pt_payments own read" ON public.pt_payments;
DROP POLICY IF EXISTS "pt_refunds own read" ON public.pt_refunds;
DROP POLICY IF EXISTS "Members view own PT usage" ON public.pt_session_usage;
DROP POLICY IF EXISTS "Clients read their own installments" ON public.pt_payment_plan_installments;
CREATE POLICY "Financial staff read installments" ON public.pt_payment_plan_installments
  FOR SELECT TO authenticated USING (public.pt_is_financial_staff(auth.uid()));