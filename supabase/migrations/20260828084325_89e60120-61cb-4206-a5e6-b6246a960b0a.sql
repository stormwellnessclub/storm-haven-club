-- =========================================================
-- PHASE 2C: PT invoices, refunds, corrections, communications
-- =========================================================

-- ---------- invoice number sequence ----------
CREATE SEQUENCE IF NOT EXISTS public.pt_invoice_number_seq START 1000;

-- ---------- pt_invoices ----------
CREATE TABLE IF NOT EXISTS public.pt_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  due_date date,
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  amount_due_cents integer NOT NULL DEFAULT 0,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  notes text,
  internal_notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pt_invoices_status_check CHECK (status IN ('draft','sent','viewed','partially_paid','paid','past_due','void'))
);

GRANT SELECT, INSERT, UPDATE ON public.pt_invoices TO authenticated;
GRANT ALL ON public.pt_invoices TO service_role;
ALTER TABLE public.pt_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_invoices staff read" ON public.pt_invoices
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "pt_invoices own read" ON public.pt_invoices
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND status <> 'draft');

CREATE INDEX IF NOT EXISTS pt_invoices_user_idx ON public.pt_invoices(user_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS pt_invoices_status_idx ON public.pt_invoices(status);

CREATE TRIGGER pt_invoices_touch BEFORE UPDATE ON public.pt_invoices
  FOR EACH ROW EXECUTE FUNCTION public.pt_touch_updated_at();

-- ---------- pt_invoice_line_items ----------
CREATE TABLE IF NOT EXISTS public.pt_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.pt_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_amount_cents integer NOT NULL,
  amount_cents integer NOT NULL,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pt_invoice_line_items TO authenticated;
GRANT ALL ON public.pt_invoice_line_items TO service_role;
ALTER TABLE public.pt_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_invoice_lines staff read" ON public.pt_invoice_line_items
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "pt_invoice_lines own read" ON public.pt_invoice_line_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.pt_invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status <> 'draft'));

CREATE INDEX IF NOT EXISTS pt_invoice_lines_invoice_idx ON public.pt_invoice_line_items(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS pt_invoice_lines_appt_open_uidx
  ON public.pt_invoice_line_items(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- ---------- pt_refunds ----------
CREATE TABLE IF NOT EXISTS public.pt_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.pt_payments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL CHECK (method IN ('stripe','manual')),
  stripe_refund_id text,
  reason text NOT NULL,
  invoice_id uuid REFERENCES public.pt_invoices(id) ON DELETE SET NULL,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  idempotency_key text,
  refunded_by uuid,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pt_refunds TO authenticated;
GRANT ALL ON public.pt_refunds TO service_role;
ALTER TABLE public.pt_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_refunds staff read" ON public.pt_refunds
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "pt_refunds own read" ON public.pt_refunds
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS pt_refunds_idem_uidx ON public.pt_refunds(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pt_refunds_stripe_uidx ON public.pt_refunds(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pt_refunds_payment_idx ON public.pt_refunds(payment_id);

-- ---------- pt_payment_corrections ----------
CREATE TABLE IF NOT EXISTS public.pt_payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.pt_payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.pt_invoices(id) ON DELETE CASCADE,
  correction_type text NOT NULL,
  field_name text,
  original_value text,
  corrected_value text,
  reason text NOT NULL,
  corrected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pt_payment_corrections TO authenticated;
GRANT ALL ON public.pt_payment_corrections TO service_role;
ALTER TABLE public.pt_payment_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_corrections staff read" ON public.pt_payment_corrections
  FOR SELECT TO authenticated USING (public.pt_is_financial_staff(auth.uid()));

-- ---------- pt_payment_communications ----------
CREATE TABLE IF NOT EXISTS public.pt_payment_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  recipient text NOT NULL,
  comm_type text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  template text,
  payment_id uuid REFERENCES public.pt_payments(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.pt_invoices(id) ON DELETE SET NULL,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'queued',
  failure_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pt_payment_communications TO authenticated;
GRANT ALL ON public.pt_payment_communications TO service_role;
ALTER TABLE public.pt_payment_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_pay_comms staff read" ON public.pt_payment_communications
  FOR SELECT TO authenticated USING (public.pt_is_financial_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS pt_pay_comms_invoice_idx ON public.pt_payment_communications(invoice_id);

-- ---------- extend existing financial tables ----------
ALTER TABLE public.pt_payments
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.pt_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'session';

ALTER TABLE public.pt_payment_allocations
  ADD COLUMN IF NOT EXISTS invoice_line_item_id uuid REFERENCES public.pt_invoice_line_items(id) ON DELETE SET NULL;

ALTER TABLE public.payment_dunning_state
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'membership',
  ADD COLUMN IF NOT EXISTS pt_pass_id uuid,
  ADD COLUMN IF NOT EXISTS pt_invoice_id uuid;

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- recalculate invoice totals + status from line items and payments
CREATE OR REPLACE FUNCTION public.pt_recalc_invoice(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_inv public.pt_invoices%ROWTYPE;
  v_sub integer;
  v_paid integer;
  v_total integer;
  v_status text;
BEGIN
  SELECT * INTO v_inv FROM public.pt_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount_cents),0), COALESCE(SUM(amount_paid_cents),0)
    INTO v_sub, v_paid
  FROM public.pt_invoice_line_items WHERE invoice_id = p_invoice_id;

  v_total := GREATEST(v_sub - v_inv.discount_cents + v_inv.tax_cents, 0);

  IF v_inv.status = 'void' THEN
    v_status := 'void';
  ELSIF v_paid >= v_total AND v_total > 0 THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partially_paid';
  ELSIF v_inv.status IN ('draft') THEN
    v_status := 'draft';
  ELSIF v_inv.due_date IS NOT NULL
        AND v_inv.due_date < (now() AT TIME ZONE 'America/Detroit')::date THEN
    v_status := 'past_due';
  ELSE
    v_status := COALESCE(NULLIF(v_inv.status,'past_due'), 'sent');
  END IF;

  UPDATE public.pt_invoices
     SET subtotal_cents = v_sub,
         total_cents = v_total,
         amount_paid_cents = v_paid,
         amount_due_cents = GREATEST(v_total - v_paid, 0),
         status = v_status,
         paid_at = CASE WHEN v_status = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END
   WHERE id = p_invoice_id;
END;
$$;

-- create an invoice from unpaid appointments / a package balance / custom lines
CREATE OR REPLACE FUNCTION public.pt_create_invoice(
  p_user_id uuid,
  p_appointment_ids uuid[] DEFAULT NULL,
  p_pass_id uuid DEFAULT NULL,
  p_custom_lines jsonb DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_discount_cents integer DEFAULT 0,
  p_tax_cents integer DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_invoice public.pt_invoices%ROWTYPE;
  v_id uuid;
  v_appt public.pt_appointments%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
  v_line jsonb;
  v_number text;
  v_lines integer := 0;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF COALESCE(p_discount_cents,0) < 0 OR COALESCE(p_tax_cents,0) < 0 THEN
    RAISE EXCEPTION 'Discount and tax must be zero or positive';
  END IF;

  v_number := 'PT-' || to_char(now() AT TIME ZONE 'America/Detroit','YYYY') || '-' ||
              lpad(nextval('public.pt_invoice_number_seq')::text, 5, '0');

  INSERT INTO public.pt_invoices (user_id, invoice_number, due_date, discount_cents, tax_cents,
                                  notes, internal_notes, pass_id, created_by)
  VALUES (p_user_id, v_number, p_due_date, COALESCE(p_discount_cents,0), COALESCE(p_tax_cents,0),
          p_notes, p_internal_notes, p_pass_id, auth.uid())
  RETURNING * INTO v_invoice;

  IF p_appointment_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_appointment_ids LOOP
      SELECT * INTO v_appt FROM public.pt_appointments WHERE id = v_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
      IF v_appt.user_id <> p_user_id THEN RAISE EXCEPTION 'All sessions must belong to one client'; END IF;
      IF COALESCE(v_appt.payment_status,'unpaid') NOT IN ('unpaid','past_due') THEN
        RAISE EXCEPTION 'PT_ALREADY_SETTLED: session on % is already settled',
          to_char(v_appt.starts_at,'Mon DD, YYYY');
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.pt_invoice_line_items li
        JOIN public.pt_invoices i ON i.id = li.invoice_id
        WHERE li.appointment_id = v_id AND i.status <> 'void'
      ) THEN
        RAISE EXCEPTION 'PT_ALREADY_INVOICED: session on % is already on an invoice',
          to_char(v_appt.starts_at,'Mon DD, YYYY');
      END IF;

      INSERT INTO public.pt_invoice_line_items
        (invoice_id, description, quantity, unit_amount_cents, amount_cents, appointment_id)
      VALUES (v_invoice.id,
              'Personal Training Session — ' || to_char(v_appt.starts_at AT TIME ZONE 'America/Detroit','Mon DD, YYYY'),
              1, COALESCE(v_appt.amount_due_cents,0), COALESCE(v_appt.amount_due_cents,0), v_id);
      v_lines := v_lines + 1;
    END LOOP;
  END IF;

  IF p_pass_id IS NOT NULL AND (p_appointment_ids IS NULL OR array_length(p_appointment_ids,1) IS NULL) THEN
    SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
    IF v_pass.user_id <> p_user_id THEN RAISE EXCEPTION 'Package belongs to another client'; END IF;
    IF COALESCE(v_pass.amount_outstanding_cents,0) <= 0 THEN
      RAISE EXCEPTION 'PT_NOTHING_OUTSTANDING: this package has no outstanding balance';
    END IF;
    INSERT INTO public.pt_invoice_line_items
      (invoice_id, description, quantity, unit_amount_cents, amount_cents, pass_id)
    VALUES (v_invoice.id, 'Package balance — ' || COALESCE(v_pass.pack_name,'PT Package'),
            1, v_pass.amount_outstanding_cents, v_pass.amount_outstanding_cents, p_pass_id);
    v_lines := v_lines + 1;
  END IF;

  IF p_custom_lines IS NOT NULL THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_custom_lines) LOOP
      IF COALESCE((v_line->>'unit_amount_cents')::int,0) < 0 THEN
        RAISE EXCEPTION 'Line amount cannot be negative';
      END IF;
      INSERT INTO public.pt_invoice_line_items
        (invoice_id, description, quantity, unit_amount_cents, amount_cents)
      VALUES (v_invoice.id,
              COALESCE(NULLIF(trim(v_line->>'description'),''),'PT charge'),
              GREATEST(COALESCE((v_line->>'quantity')::int,1),1),
              COALESCE((v_line->>'unit_amount_cents')::int,0),
              GREATEST(COALESCE((v_line->>'quantity')::int,1),1) * COALESCE((v_line->>'unit_amount_cents')::int,0));
      v_lines := v_lines + 1;
    END LOOP;
  END IF;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'PT_NO_LINES: an invoice needs at least one line item';
  END IF;

  PERFORM public.pt_recalc_invoice(v_invoice.id);
  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'invoice_number', v_number, 'lines', v_lines);
END;
$$;

-- mark invoice sent
CREATE OR REPLACE FUNCTION public.pt_send_invoice(p_invoice_id uuid, p_recipient text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inv public.pt_invoices%ROWTYPE; v_email text;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_inv FROM public.pt_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'void' THEN RAISE EXCEPTION 'PT_VOID_INVOICE: this invoice is voided'; END IF;
  IF v_inv.status = 'paid' THEN RAISE EXCEPTION 'PT_ALREADY_PAID: this invoice is already paid'; END IF;

  v_email := COALESCE(p_recipient, (SELECT email FROM public.profiles WHERE user_id = v_inv.user_id LIMIT 1));

  UPDATE public.pt_invoices
     SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
         sent_at = now()
   WHERE id = p_invoice_id;

  INSERT INTO public.pt_payment_communications (user_id, recipient, comm_type, template, invoice_id, created_by)
  VALUES (v_inv.user_id, COALESCE(v_email,'unknown'), 'invoice_sent', 'pt_invoice', p_invoice_id, auth.uid());

  PERFORM public.pt_recalc_invoice(p_invoice_id);
  RETURN jsonb_build_object('success', true, 'recipient', v_email);
END;
$$;

-- void an unpaid invoice
CREATE OR REPLACE FUNCTION public.pt_void_invoice(p_invoice_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inv public.pt_invoices%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO v_inv FROM public.pt_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'void' THEN RETURN jsonb_build_object('success', true, 'already_void', true); END IF;
  IF v_inv.amount_paid_cents > 0 THEN
    RAISE EXCEPTION 'PT_INVOICE_HAS_PAYMENTS: refund the payments before voiding this invoice';
  END IF;

  UPDATE public.pt_invoices
     SET status = 'void', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason,
         amount_due_cents = 0
   WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- record a payment against an invoice (full or partial), settling linked appointments
CREATE OR REPLACE FUNCTION public.pt_record_invoice_payment(
  p_invoice_id uuid,
  p_method text,
  p_amount_cents integer,
  p_paid_at timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_inv public.pt_invoices%ROWTYPE;
  v_payment public.pt_payments%ROWTYPE;
  v_line public.pt_invoice_line_items%ROWTYPE;
  v_remaining integer;
  v_alloc integer;
  v_settled integer := 0;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_method NOT IN ('card','cash','check','terminal','bank_transfer','other') THEN
    RAISE EXCEPTION 'Unsupported payment method %', p_method;
  END IF;
  IF COALESCE(p_amount_cents,0) <= 0 THEN RAISE EXCEPTION 'PT_INVALID_AMOUNT: amount must be greater than zero'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.pt_payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_payment.id); END IF;
  END IF;
  IF p_stripe_payment_intent_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.pt_payments WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
    IF FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'payment_id', v_payment.id); END IF;
  END IF;

  SELECT * INTO v_inv FROM public.pt_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'void' THEN RAISE EXCEPTION 'PT_VOID_INVOICE: cannot collect on a voided invoice'; END IF;
  IF v_inv.amount_due_cents <= 0 THEN RAISE EXCEPTION 'PT_ALREADY_PAID: this invoice is fully paid'; END IF;
  IF p_amount_cents > v_inv.amount_due_cents THEN
    RAISE EXCEPTION 'PT_OVERPAYMENT: amount exceeds the % remaining on this invoice', v_inv.amount_due_cents;
  END IF;

  INSERT INTO public.pt_payments (user_id, amount_cents, method, status, stripe_payment_intent_id,
                                  reference, note, paid_at, recorded_by, idempotency_key,
                                  invoice_id, payment_type)
  VALUES (v_inv.user_id, p_amount_cents, p_method, 'succeeded', p_stripe_payment_intent_id,
          p_reference, p_note, COALESCE(p_paid_at, now()), auth.uid(), p_idempotency_key,
          p_invoice_id, 'invoice')
  RETURNING * INTO v_payment;

  v_remaining := p_amount_cents;

  FOR v_line IN
    SELECT * FROM public.pt_invoice_line_items
    WHERE invoice_id = p_invoice_id AND amount_paid_cents < amount_cents
    ORDER BY created_at
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := LEAST(v_remaining, v_line.amount_cents - v_line.amount_paid_cents);

    UPDATE public.pt_invoice_line_items
       SET amount_paid_cents = amount_paid_cents + v_alloc,
           settled_at = CASE WHEN amount_paid_cents + v_alloc >= amount_cents THEN now() ELSE settled_at END
     WHERE id = v_line.id;

    INSERT INTO public.pt_payment_allocations (payment_id, appointment_id, pass_id, amount_cents, invoice_line_item_id)
    VALUES (v_payment.id, v_line.appointment_id, v_line.pass_id, v_alloc, v_line.id)
    ON CONFLICT DO NOTHING;

    -- fully paid line settles its appointment
    IF v_line.appointment_id IS NOT NULL AND (v_line.amount_paid_cents + v_alloc) >= v_line.amount_cents THEN
      UPDATE public.pt_appointments
         SET payment_status = 'paid',
             payment_method = p_method,
             stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
             payment_note = COALESCE(payment_note, 'Invoice ' || v_inv.invoice_number)
       WHERE id = v_line.appointment_id;
      v_settled := v_settled + 1;
    END IF;

    -- fully paid package line reduces package outstanding
    IF v_line.pass_id IS NOT NULL AND (v_line.amount_paid_cents + v_alloc) >= v_line.amount_cents THEN
      UPDATE public.pt_passes
         SET amount_paid_cents = COALESCE(amount_paid_cents,0) + v_line.amount_cents,
             amount_outstanding_cents = GREATEST(COALESCE(amount_outstanding_cents,0) - v_line.amount_cents, 0),
             financial_status = CASE
               WHEN GREATEST(COALESCE(amount_outstanding_cents,0) - v_line.amount_cents, 0) = 0 THEN 'paid'
               ELSE 'partially_paid' END
       WHERE id = v_line.pass_id;
    END IF;

    v_remaining := v_remaining - v_alloc;
  END LOOP;

  PERFORM public.pt_recalc_invoice(p_invoice_id);

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment.id, 'sessions_settled', v_settled);
END;
$$;

-- record a refund against an existing PT payment
CREATE OR REPLACE FUNCTION public.pt_record_refund(
  p_payment_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_method text DEFAULT NULL,
  p_stripe_refund_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pay public.pt_payments%ROWTYPE;
  v_method text;
  v_net integer;
  v_refund public.pt_refunds%ROWTYPE;
  v_total_refunded integer;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'A refund reason is required'; END IF;
  IF COALESCE(p_amount_cents,0) <= 0 THEN RAISE EXCEPTION 'PT_INVALID_AMOUNT: refund must be greater than zero'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_refund FROM public.pt_refunds WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true, 'refund_id', v_refund.id); END IF;
  END IF;

  SELECT * INTO v_pay FROM public.pt_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay.status NOT IN ('succeeded','partially_refunded') THEN
    RAISE EXCEPTION 'PT_NOT_REFUNDABLE: only successful payments can be refunded';
  END IF;

  v_net := v_pay.amount_cents - COALESCE(v_pay.refunded_cents,0);
  IF p_amount_cents > v_net THEN
    RAISE EXCEPTION 'PT_REFUND_EXCEEDS_NET: maximum refundable is %', v_net;
  END IF;

  v_method := COALESCE(p_method, CASE WHEN v_pay.stripe_payment_intent_id IS NOT NULL THEN 'stripe' ELSE 'manual' END);
  IF v_method NOT IN ('stripe','manual') THEN RAISE EXCEPTION 'Unsupported refund method'; END IF;
  IF v_method = 'stripe' AND v_pay.stripe_payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'PT_NOT_STRIPE: this payment was not collected through Stripe';
  END IF;

  INSERT INTO public.pt_refunds (payment_id, user_id, amount_cents, method, stripe_refund_id, reason,
                                 invoice_id, idempotency_key, refunded_by)
  VALUES (p_payment_id, v_pay.user_id, p_amount_cents, v_method, p_stripe_refund_id, p_reason,
          v_pay.invoice_id, p_idempotency_key, auth.uid())
  RETURNING * INTO v_refund;

  v_total_refunded := COALESCE(v_pay.refunded_cents,0) + p_amount_cents;

  UPDATE public.pt_payments
     SET refunded_cents = v_total_refunded,
         status = CASE WHEN v_total_refunded >= amount_cents THEN 'refunded' ELSE 'partially_refunded' END
   WHERE id = p_payment_id;

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund.id,
                            'refunded_total_cents', v_total_refunded,
                            'net_paid_cents', v_pay.amount_cents - v_total_refunded);
END;
$$;

-- append-only correction record (no silent edits to money rows)
CREATE OR REPLACE FUNCTION public.pt_correct_payment(
  p_payment_id uuid,
  p_correction_type text,
  p_field_name text,
  p_corrected_value text,
  p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pay public.pt_payments%ROWTYPE;
  v_original text;
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO v_pay FROM public.pt_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF p_correction_type NOT IN ('method_label','note','reference','void_duplicate') THEN
    RAISE EXCEPTION 'PT_UNSUPPORTED_CORRECTION: %', p_correction_type;
  END IF;

  IF v_pay.stripe_payment_intent_id IS NOT NULL AND p_correction_type IN ('method_label','void_duplicate') THEN
    RAISE EXCEPTION 'PT_STRIPE_IMMUTABLE: Stripe-originated payments cannot be edited locally';
  END IF;

  v_original := CASE p_correction_type
    WHEN 'method_label' THEN v_pay.method
    WHEN 'note' THEN v_pay.note
    WHEN 'reference' THEN v_pay.reference
    ELSE v_pay.status END;

  INSERT INTO public.pt_payment_corrections
    (payment_id, correction_type, field_name, original_value, corrected_value, reason, corrected_by)
  VALUES (p_payment_id, p_correction_type, p_field_name, v_original, p_corrected_value, p_reason, auth.uid());

  IF p_correction_type = 'method_label' THEN
    IF p_corrected_value NOT IN ('cash','check','terminal','bank_transfer','other') THEN
      RAISE EXCEPTION 'Unsupported payment method label';
    END IF;
    UPDATE public.pt_payments SET method = p_corrected_value WHERE id = p_payment_id;
  ELSIF p_correction_type = 'note' THEN
    UPDATE public.pt_payments SET note = p_corrected_value WHERE id = p_payment_id;
  ELSIF p_correction_type = 'reference' THEN
    UPDATE public.pt_payments SET reference = p_corrected_value WHERE id = p_payment_id;
  ELSIF p_correction_type = 'void_duplicate' THEN
    UPDATE public.pt_payments SET status = 'voided' WHERE id = p_payment_id;
    UPDATE public.pt_invoice_line_items li
       SET amount_paid_cents = GREATEST(li.amount_paid_cents - a.amount_cents, 0), settled_at = NULL
      FROM public.pt_payment_allocations a
     WHERE a.payment_id = p_payment_id AND a.invoice_line_item_id = li.id;
    IF v_pay.invoice_id IS NOT NULL THEN PERFORM public.pt_recalc_invoice(v_pay.invoice_id); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'original_value', v_original);
END;
$$;

-- single outstanding-balance calculation, no double counting
CREATE OR REPLACE FUNCTION public.pt_outstanding_balance(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_invoiced integer := 0;
  v_sessions integer := 0;
  v_packages integer := 0;
  v_plan integer := 0;
BEGIN
  IF NOT (public.pt_is_staff_or_desk(auth.uid()) OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 1. open invoices (most specific obligation)
  SELECT COALESCE(SUM(amount_due_cents),0) INTO v_invoiced
  FROM public.pt_invoices
  WHERE user_id = p_user_id AND status IN ('draft','sent','viewed','partially_paid','past_due');

  -- 2. unpaid sessions NOT already on an open invoice
  SELECT COALESCE(SUM(a.amount_due_cents),0) INTO v_sessions
  FROM public.pt_appointments a
  WHERE a.user_id = p_user_id
    AND COALESCE(a.payment_status,'unpaid') IN ('unpaid','past_due')
    AND a.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.pt_invoice_line_items li
      JOIN public.pt_invoices i ON i.id = li.invoice_id
      WHERE li.appointment_id = a.id AND i.status <> 'void');

  -- 3. package outstanding NOT already invoiced and not covered by an active plan
  SELECT COALESCE(SUM(p.amount_outstanding_cents),0) INTO v_packages
  FROM public.pt_passes p
  WHERE p.user_id = p_user_id
    AND COALESCE(p.amount_outstanding_cents,0) > 0
    AND COALESCE(p.payment_plan_status,'none') NOT IN ('active','past_due')
    AND NOT EXISTS (
      SELECT 1 FROM public.pt_invoice_line_items li
      JOIN public.pt_invoices i ON i.id = li.invoice_id
      WHERE li.pass_id = p.id AND i.status <> 'void');

  -- 4. remaining plan installments (packages on an active plan, never invoiced separately)
  SELECT COALESCE(SUM(
    GREATEST(COALESCE(p.payment_plan_total_installments,0) - COALESCE(p.payment_plan_installments_paid,0), 0)
    * COALESCE(p.payment_plan_installment_cents,0)), 0) INTO v_plan
  FROM public.pt_passes p
  WHERE p.user_id = p_user_id
    AND COALESCE(p.payment_plan_status,'none') IN ('active','past_due')
    AND NOT EXISTS (
      SELECT 1 FROM public.pt_invoice_line_items li
      JOIN public.pt_invoices i ON i.id = li.invoice_id
      WHERE li.pass_id = p.id AND i.status <> 'void');

  RETURN jsonb_build_object(
    'open_invoices_cents', v_invoiced,
    'uninvoiced_sessions_cents', v_sessions,
    'package_balance_cents', v_packages,
    'plan_remaining_cents', v_plan,
    'total_outstanding_cents', v_invoiced + v_sessions + v_packages + v_plan
  );
END;
$$;

-- client-safe financial summary + history (own records only)
CREATE OR REPLACE FUNCTION public.pt_my_financial_history()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN jsonb_build_object(
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'paid_at', p.paid_at, 'amount_cents', p.amount_cents,
        'refunded_cents', p.refunded_cents, 'method', p.method, 'status', p.status,
        'type', p.payment_type, 'reference', p.reference, 'invoice_id', p.invoice_id)
        ORDER BY p.paid_at DESC)
      FROM public.pt_payments p WHERE p.user_id = v_uid AND p.status <> 'voided'), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'invoice_number', i.invoice_number, 'issue_date', i.issue_date,
        'due_date', i.due_date, 'status', i.status, 'total_cents', i.total_cents,
        'amount_paid_cents', i.amount_paid_cents, 'amount_due_cents', i.amount_due_cents)
        ORDER BY i.issue_date DESC)
      FROM public.pt_invoices i WHERE i.user_id = v_uid AND i.status <> 'draft'), '[]'::jsonb),
    'refunds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'refunded_at', r.refunded_at, 'amount_cents', r.amount_cents, 'method', r.method)
        ORDER BY r.refunded_at DESC)
      FROM public.pt_refunds r WHERE r.user_id = v_uid), '[]'::jsonb),
    'upcoming', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'pass_id', p.id, 'pack_name', p.pack_name,
        'next_payment_date', p.payment_plan_next_payment_date,
        'installment_cents', p.payment_plan_installment_cents,
        'plan_status', p.payment_plan_status))
      FROM public.pt_passes p
      WHERE p.user_id = v_uid AND p.payment_plan_status IN ('active','past_due')), '[]'::jsonb),
    'outstanding', public.pt_outstanding_balance(v_uid)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pt_create_invoice(uuid, uuid[], uuid, jsonb, date, integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_send_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_void_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_record_invoice_payment(uuid, text, integer, timestamptz, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_record_refund(uuid, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_correct_payment(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_outstanding_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_my_financial_history() TO authenticated;