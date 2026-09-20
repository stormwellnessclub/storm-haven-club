CREATE OR REPLACE FUNCTION public.recalc_event_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid integer;
  v_refunded integer;
  v_inv public.event_invoices%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_inv FROM public.event_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(CASE WHEN direction = 'payment' THEN amount_cents ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN direction = 'refund' THEN amount_cents ELSE 0 END), 0)
    INTO v_paid, v_refunded
    FROM public.event_payments WHERE invoice_id = p_invoice_id;

  v_status := v_inv.status;
  IF v_inv.status NOT IN ('void') THEN
    IF v_refunded > 0 AND v_refunded >= v_paid AND v_paid > 0 THEN
      v_status := 'refunded';
    ELSIF v_refunded > 0 THEN
      v_status := 'partially_refunded';
    ELSIF v_paid >= v_inv.amount_cents AND v_inv.amount_cents > 0 THEN
      v_status := 'paid';
    ELSIF v_paid > 0 THEN
      v_status := 'partially_paid';
    ELSIF v_inv.status IN ('paid','partially_paid','refunded','partially_refunded') THEN
      -- every payment was removed or reversed: fall back to its pre-payment state
      v_status := CASE WHEN v_inv.sent_at IS NULL THEN 'draft' ELSE 'sent' END;
    ELSIF v_inv.due_date IS NOT NULL AND v_inv.due_date < (now() AT TIME ZONE 'America/Detroit')::date
          AND v_inv.status IN ('sent','viewed','ready','scheduled','overdue') THEN
      v_status := 'overdue';
    END IF;
  END IF;

  UPDATE public.event_invoices
     SET amount_paid_cents = v_paid,
         amount_refunded_cents = v_refunded,
         status = v_status,
         paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END
   WHERE id = p_invoice_id;
END;
$$;