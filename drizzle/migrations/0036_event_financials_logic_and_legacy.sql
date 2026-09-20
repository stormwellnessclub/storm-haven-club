ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS review_note text;

-- ------------------------------------------------------------
-- Recalculate an invoice's paid/refunded amounts + status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_event_invoice(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    ELSIF v_inv.due_date IS NOT NULL AND v_inv.due_date < (now() AT TIME ZONE 'America/Detroit')::date
          AND v_inv.status IN ('sent','viewed','ready','scheduled','overdue') THEN
      v_status := 'overdue';
    END IF;
  END IF;

  UPDATE public.event_invoices
     SET amount_paid_cents = v_paid,
         amount_refunded_cents = v_refunded,
         status = v_status,
         paid_at = CASE WHEN v_status = 'paid' AND paid_at IS NULL THEN now()
                        WHEN v_status <> 'paid' THEN paid_at ELSE paid_at END
   WHERE id = p_invoice_id;
END; $$;

CREATE OR REPLACE FUNCTION public.event_payments_recalc_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN PERFORM public.recalc_event_invoice(OLD.invoice_id); END IF;
    RETURN OLD;
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN PERFORM public.recalc_event_invoice(NEW.invoice_id); END IF;
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.recalc_event_invoice(OLD.invoice_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_event_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.event_payments
FOR EACH ROW EXECUTE FUNCTION public.event_payments_recalc_trg();

-- ------------------------------------------------------------
-- Rollup view: one row per financial workspace
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.event_financial_rollup
WITH (security_invoker = true) AS
SELECT
  f.id AS financial_id,
  f.private_event_id,
  f.event_id,
  f.event_kind,
  COALESCE(f.title, pe.title, e.title) AS event_title,
  COALESCE(f.client_name, NULLIF(TRIM(CONCAT(pe.client_first_name, ' ', pe.client_last_name)), ''), '') AS client_name,
  COALESCE(f.client_email, pe.client_email) AS client_email,
  COALESCE(pe.event_date, (e.starts_at AT TIME ZONE 'America/Detroit')::date) AS event_date,
  f.assigned_staff_id,
  f.confirmed_at,
  f.needs_review,
  COALESCE(inv.invoiced_cents, 0) AS invoiced_cents,
  COALESCE(inv.paid_cents, 0) AS paid_cents,
  COALESCE(inv.refunded_cents, 0) AS refunded_cents,
  GREATEST(COALESCE(inv.invoiced_cents, 0) - COALESCE(inv.paid_cents, 0) + COALESCE(inv.refunded_cents, 0), 0) AS outstanding_cents,
  inv.next_due_date,
  inv.final_due_date,
  COALESCE(inv.overdue_cents, 0) AS overdue_cents
FROM public.event_financials f
LEFT JOIN public.private_events pe ON pe.id = f.private_event_id
LEFT JOIN public.events e ON e.id = f.event_id
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN i.status <> 'void' THEN i.amount_cents ELSE 0 END) AS invoiced_cents,
    SUM(i.amount_paid_cents) AS paid_cents,
    SUM(i.amount_refunded_cents) AS refunded_cents,
    SUM(CASE WHEN i.status = 'overdue' THEN i.amount_cents - i.amount_paid_cents ELSE 0 END) AS overdue_cents,
    MIN(i.due_date) FILTER (WHERE i.status NOT IN ('paid','void','refunded')) AS next_due_date,
    MAX(i.due_date) FILTER (WHERE i.status <> 'void') AS final_due_date
  FROM public.event_invoices i WHERE i.financial_id = f.id
) inv ON TRUE;

GRANT SELECT ON public.event_financial_rollup TO authenticated, service_role;

-- ------------------------------------------------------------
-- Ensure / migrate a financial workspace for a private event
-- Idempotent, non-destructive: never touches legacy rows.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_private_event_financials(p_private_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fin_id uuid;
  v_pe public.private_events%ROWTYPE;
  v_row record;
  v_new_invoice uuid;
  v_review boolean := false;
  v_note text := NULL;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO v_pe FROM public.private_events WHERE id = p_private_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private event not found'; END IF;

  SELECT id INTO v_fin_id FROM public.event_financials WHERE private_event_id = p_private_event_id;
  IF v_fin_id IS NOT NULL THEN RETURN v_fin_id; END IF;

  INSERT INTO public.event_financials (
    private_event_id, event_kind, title, client_name, client_email, client_phone,
    pricing_mode, package_price_cents, tax_enabled, pass_processing_fee,
    created_by, legacy_source, requires_deposit
  ) VALUES (
    p_private_event_id,
    CASE WHEN v_pe.event_type ILIKE '%corporate%' THEN 'corporate' ELSE 'private' END,
    v_pe.title,
    NULLIF(TRIM(CONCAT(v_pe.client_first_name, ' ', v_pe.client_last_name)), ''),
    v_pe.client_email, v_pe.client_phone,
    CASE WHEN COALESCE(v_pe.flat_total_cents, 0) > 0 THEN 'flat' ELSE 'itemized' END,
    COALESCE(v_pe.flat_total_cents, 0),
    COALESCE(v_pe.tax_enabled, true),
    COALESCE(v_pe.pass_processing_fee, false),
    auth.uid(), 'private_events', true
  ) RETURNING id INTO v_fin_id;

  -- line items -> priced items (or included items when a flat price rules)
  FOR v_row IN SELECT * FROM public.private_event_line_items WHERE event_id = p_private_event_id ORDER BY sort_order LOOP
    INSERT INTO public.event_financial_items (
      financial_id, classification, label, quantity, unit_price_cents, taxable,
      sort_order, legacy_line_item_id, show_price
    ) VALUES (
      v_fin_id,
      CASE WHEN COALESCE(v_pe.flat_total_cents, 0) > 0 THEN 'included' ELSE 'priced' END,
      v_row.label, v_row.quantity, v_row.unit_price_cents, v_row.taxable,
      v_row.sort_order, v_row.id,
      CASE WHEN COALESCE(v_pe.flat_total_cents, 0) > 0 THEN false ELSE true END
    );
  END LOOP;

  -- invoices -> unified invoices (+ payment ledger rows for anything already paid)
  FOR v_row IN SELECT * FROM public.private_event_invoices WHERE event_id = p_private_event_id ORDER BY created_at LOOP
    INSERT INTO public.event_invoices (
      financial_id, invoice_type, label, amount_cents, status, due_date,
      pay_token, stripe_checkout_session_id, stripe_payment_intent_id,
      payment_method, sent_at, paid_at, notes, legacy_invoice_id, created_by, issue_date
    ) VALUES (
      v_fin_id,
      CASE WHEN v_row.kind = 'deposit' THEN 'deposit'
           WHEN v_row.kind = 'balance' THEN 'balance' ELSE 'custom' END,
      v_row.label, v_row.amount_cents,
      CASE v_row.status WHEN 'paid' THEN 'paid' WHEN 'sent' THEN 'sent' WHEN 'void' THEN 'void' ELSE 'draft' END,
      v_row.due_date, v_row.pay_token, v_row.stripe_checkout_session_id, v_row.stripe_payment_intent_id,
      v_row.payment_method, v_row.sent_at, v_row.paid_at, v_row.notes, v_row.id, v_row.created_by,
      COALESCE(v_row.sent_at::date, v_row.created_at::date)
    ) RETURNING id INTO v_new_invoice;

    IF v_row.status = 'paid' THEN
      INSERT INTO public.event_payments (
        financial_id, invoice_id, direction, amount_cents, method,
        stripe_payment_intent_id, occurred_at, notes
      ) VALUES (
        v_fin_id, v_new_invoice, 'payment', v_row.amount_cents,
        COALESCE(v_row.payment_method, 'card_online'), v_row.stripe_payment_intent_id,
        COALESCE(v_row.paid_at, v_row.created_at), 'Imported from legacy private event invoice'
      );
    END IF;
  END LOOP;

  -- flag anything that cannot be reconciled automatically
  IF COALESCE(v_pe.flat_total_cents, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM public.private_event_line_items WHERE event_id = p_private_event_id)
     AND EXISTS (SELECT 1 FROM public.private_event_invoices WHERE event_id = p_private_event_id) THEN
    v_review := true;
    v_note := 'Legacy invoices exist with no quote lines or flat price — confirm the contracted total.';
  END IF;

  IF v_review THEN
    UPDATE public.event_financials SET needs_review = true, review_note = v_note WHERE id = v_fin_id;
  END IF;

  INSERT INTO public.event_financial_activity (financial_id, kind, message, actor_id)
  VALUES (v_fin_id, 'migration', 'Financial workspace created from the existing private event record.', auth.uid());

  RETURN v_fin_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_private_event_financials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_event_invoice(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Overdue sweep (safe to run repeatedly)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_event_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.event_invoices
     SET status = 'overdue'
   WHERE status IN ('sent','viewed','scheduled','ready','partially_paid')
     AND due_date IS NOT NULL
     AND due_date < (now() AT TIME ZONE 'America/Detroit')::date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- ------------------------------------------------------------
-- Seed reusable templates
-- ------------------------------------------------------------
INSERT INTO public.event_financial_templates (slug, name, description, event_kind, config, sort_order) VALUES
('private-wellness-experience','Private Wellness Experience','Flat-fee buyout of selected spaces with wet spa, nourishment and staffing included.','private',
 '{"pricing_mode":"flat","package_name":"Private Wellness Experience","package_price_cents":250000,"tax_enabled":true,"included":["Private use of selected spaces","Wet spa experience","Amino welcome beverages","Seasonal fruit presentation","Grazing boards","Hydration station","Event staffing","Setup, turnover and turndown"],"optional":[{"label":"Additional service","unit_price_cents":0},{"label":"Additional hour","unit_price_cents":0}],"schedule":[{"type":"deposit","percent":50,"days_before":0},{"type":"balance","percent":50,"days_before":7}]}'::jsonb, 1),
('corporate-wellness-event','Corporate Wellness Event','Per-person corporate programming with facilitation and nourishment.','corporate',
 '{"pricing_mode":"per_person","tax_enabled":true,"included":["Dedicated host","Welcome beverages","Programming and facilitation"],"schedule":[{"type":"deposit","percent":50,"days_before":0},{"type":"balance","percent":50,"days_before":14}]}'::jsonb, 2),
('brand-activation','Brand Activation','Partnership activation with production and staffing.','brand_partnership',
 '{"pricing_mode":"flat","included":["Space access","On-site staffing","Setup and breakdown"],"schedule":[{"type":"deposit","percent":50,"days_before":0},{"type":"balance","percent":50,"days_before":7}]}'::jsonb, 3),
('facility-rental','Facility Rental','Hourly rental of a single space.','facility_rental',
 '{"pricing_mode":"hourly","tax_enabled":false,"included":["Space access","Basic setup"],"schedule":[{"type":"full","percent":100,"days_before":0}]}'::jsonb, 4),
('member-event','Member Event','Members-only gathering, ticketed or included.','member',
 '{"pricing_mode":"per_person","tax_enabled":false,"schedule":[{"type":"full","percent":100,"days_before":0}]}'::jsonb, 5),
('workshop','Workshop','Facilitator-led workshop with per-person pricing.','workshop',
 '{"pricing_mode":"per_person","tax_enabled":false,"schedule":[{"type":"full","percent":100,"days_before":0}]}'::jsonb, 6),
('photoshoot-production','Photoshoot or Content Production','Hourly production rental with crew and space rules.','production',
 '{"pricing_mode":"hourly","tax_enabled":false,"included":["Space access","Attendant on site"],"schedule":[{"type":"deposit","percent":50,"days_before":0},{"type":"balance","percent":50,"days_before":1}]}'::jsonb, 7),
('custom-event','Custom Event','Start from a blank itemised quote.','custom',
 '{"pricing_mode":"itemized","tax_enabled":true,"schedule":[{"type":"deposit","percent":25,"days_before":0},{"type":"balance","percent":75,"days_before":7}]}'::jsonb, 8)
ON CONFLICT (slug) DO NOTHING;