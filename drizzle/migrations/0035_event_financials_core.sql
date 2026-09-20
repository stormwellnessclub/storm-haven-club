-- ============================================================
-- Unified Events Financial layer
-- One financial workspace per event (private event OR public event record)
-- ============================================================

CREATE TABLE public.event_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  -- exactly one source link
  private_event_id uuid REFERENCES public.private_events(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  -- descriptive
  event_kind text NOT NULL DEFAULT 'private'
    CHECK (event_kind IN ('private','corporate','brand_partnership','member','workshop','facility_rental','production','public','custom')),
  title text,
  client_name text,
  client_email text,
  client_phone text,
  assigned_staff_id uuid,
  -- pricing
  pricing_mode text NOT NULL DEFAULT 'itemized'
    CHECK (pricing_mode IN ('flat','itemized','hourly','per_person','minimum_spend')),
  package_name text,
  package_price_cents integer NOT NULL DEFAULT 0,
  hourly_rate_cents integer NOT NULL DEFAULT 0,
  hours numeric NOT NULL DEFAULT 0,
  per_person_cents integer NOT NULL DEFAULT 0,
  headcount integer NOT NULL DEFAULT 0,
  minimum_spend_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  discount_label text,
  credit_cents integer NOT NULL DEFAULT 0,
  tax_enabled boolean NOT NULL DEFAULT true,
  tax_rate numeric NOT NULL DEFAULT 0.06,
  pass_processing_fee boolean NOT NULL DEFAULT false,
  service_charge_pct numeric NOT NULL DEFAULT 0,
  service_charge_label text DEFAULT 'Service charge',
  -- gates
  requires_proposal boolean NOT NULL DEFAULT false,
  requires_contract boolean NOT NULL DEFAULT false,
  requires_deposit boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  gate_override_by uuid,
  gate_override_at timestamptz,
  gate_override_reason text,
  currency text NOT NULL DEFAULT 'usd',
  internal_notes text,
  client_intro text,
  legacy_source text,
  CONSTRAINT event_financials_one_source CHECK (
    (private_event_id IS NOT NULL AND event_id IS NULL) OR
    (private_event_id IS NULL AND event_id IS NOT NULL) OR
    (private_event_id IS NULL AND event_id IS NULL)
  )
);
CREATE UNIQUE INDEX event_financials_private_uniq ON public.event_financials(private_event_id) WHERE private_event_id IS NOT NULL;
CREATE UNIQUE INDEX event_financials_event_uniq ON public.event_financials(event_id) WHERE event_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_financials TO authenticated;
GRANT ALL ON public.event_financials TO service_role;
ALTER TABLE public.event_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read event financials" ON public.event_financials FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write event financials" ON public.event_financials FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Line items: client-facing + internal cost lines in one table
-- ------------------------------------------------------------
CREATE TABLE public.event_financial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  classification text NOT NULL DEFAULT 'priced'
    CHECK (classification IN ('included','priced','optional','internal')),
  section text,
  label text NOT NULL DEFAULT '',
  client_description text,
  internal_note text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  show_quantity boolean NOT NULL DEFAULT true,
  show_price boolean NOT NULL DEFAULT true,
  selected boolean NOT NULL DEFAULT false,
  client_selectable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  legacy_line_item_id uuid
);
CREATE INDEX event_financial_items_fin_idx ON public.event_financial_items(financial_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_financial_items TO authenticated;
GRANT ALL ON public.event_financial_items TO service_role;
ALTER TABLE public.event_financial_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read financial items" ON public.event_financial_items FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write financial items" ON public.event_financial_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Invoices / installments
-- ------------------------------------------------------------
CREATE SEQUENCE public.event_invoice_number_seq START 1000;

CREATE TABLE public.event_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  invoice_number text NOT NULL DEFAULT ('SWC-' || nextval('public.event_invoice_number_seq')::text),
  invoice_type text NOT NULL DEFAULT 'installment'
    CHECK (invoice_type IN ('deposit','installment','milestone','balance','full','custom')),
  label text,
  amount_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  amount_refunded_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','ready','sent','viewed','partially_paid','paid','overdue','payment_failed','void','partially_refunded','refunded')),
  issue_date date,
  due_date date,
  scheduled_send_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  pay_token uuid NOT NULL DEFAULT gen_random_uuid(),
  last_reminder_at timestamptz,
  reminders_paused boolean NOT NULL DEFAULT false,
  assigned_staff_id uuid,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_invoices_number_uniq ON public.event_invoices(invoice_number);
CREATE UNIQUE INDEX event_invoices_token_uniq ON public.event_invoices(pay_token);
CREATE UNIQUE INDEX event_invoices_legacy_uniq ON public.event_invoices(legacy_invoice_id) WHERE legacy_invoice_id IS NOT NULL;
CREATE INDEX event_invoices_fin_idx ON public.event_invoices(financial_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invoices TO authenticated;
GRANT ALL ON public.event_invoices TO service_role;
ALTER TABLE public.event_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read event invoices" ON public.event_invoices FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write event invoices" ON public.event_invoices FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Payments & refunds ledger
-- ------------------------------------------------------------
CREATE TABLE public.event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.event_invoices(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'payment' CHECK (direction IN ('payment','refund')),
  amount_cents integer NOT NULL,
  method text NOT NULL DEFAULT 'card_online',
  reference text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_payments_fin_idx ON public.event_payments(financial_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payments TO authenticated;
GRANT ALL ON public.event_payments TO service_role;
ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read event payments" ON public.event_payments FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write event payments" ON public.event_payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Internal budget
-- ------------------------------------------------------------
CREATE TABLE public.event_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'misc'
    CHECK (category IN ('vendor','facilitator','food_beverage','staffing','decor','rentals','supplies','marketing','processing','tax','misc','revenue')),
  label text NOT NULL DEFAULT '',
  vendor text,
  estimated_cents integer NOT NULL DEFAULT 0,
  actual_cents integer,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_budget_items_fin_idx ON public.event_budget_items(financial_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_budget_items TO authenticated;
GRANT ALL ON public.event_budget_items TO service_role;
ALTER TABLE public.event_budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read budget" ON public.event_budget_items FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE POLICY "Managers write budget" ON public.event_budget_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Documents: proposal / contract / receipt
-- ------------------------------------------------------------
CREATE TABLE public.event_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('proposal','contract','receipt','other')),
  title text NOT NULL DEFAULT '',
  body text,
  terms_body text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','sent','viewed','accepted','signed','declined','void')),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_email text,
  signature_text text,
  signature_ip text,
  template_slug text,
  invoice_id uuid REFERENCES public.event_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_documents_token_uniq ON public.event_documents(access_token);
CREATE INDEX event_documents_fin_idx ON public.event_documents(financial_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_documents TO authenticated;
GRANT ALL ON public.event_documents TO service_role;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read event documents" ON public.event_documents FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write event documents" ON public.event_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Communications log
-- ------------------------------------------------------------
CREATE TABLE public.event_financial_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.event_invoices(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.event_documents(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'invoice'
    CHECK (purpose IN ('invoice','proposal','contract','receipt','reminder','custom')),
  to_email text NOT NULL,
  from_name text NOT NULL DEFAULT 'Storm Wellness Club',
  from_email text NOT NULL DEFAULT 'events@stormwellnessclub.com',
  reply_to text,
  subject text NOT NULL DEFAULT '',
  message text,
  portal_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sent','delivered','opened','failed','bounced')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_fin_comms_fin_idx ON public.event_financial_communications(financial_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_financial_communications TO authenticated;
GRANT ALL ON public.event_financial_communications TO service_role;
ALTER TABLE public.event_financial_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read fin comms" ON public.event_financial_communications FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write fin comms" ON public.event_financial_communications FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- Financial activity log
-- ------------------------------------------------------------
CREATE TABLE public.event_financial_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id uuid NOT NULL REFERENCES public.event_financials(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  message text NOT NULL,
  actor_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_fin_activity_idx ON public.event_financial_activity(financial_id, created_at DESC);
GRANT SELECT, INSERT ON public.event_financial_activity TO authenticated;
GRANT ALL ON public.event_financial_activity TO service_role;
ALTER TABLE public.event_financial_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read fin activity" ON public.event_financial_activity FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Staff write fin activity" ON public.event_financial_activity FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

-- ------------------------------------------------------------
-- Reusable financial templates
-- ------------------------------------------------------------
CREATE TABLE public.event_financial_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  event_kind text NOT NULL DEFAULT 'private',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_financial_templates_slug_uniq ON public.event_financial_templates(slug);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_financial_templates TO authenticated;
GRANT ALL ON public.event_financial_templates TO service_role;
ALTER TABLE public.event_financial_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read fin templates" ON public.event_financial_templates FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers write fin templates" ON public.event_financial_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_event_financials_touch BEFORE UPDATE ON public.event_financials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_event_invoices_touch BEFORE UPDATE ON public.event_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_event_documents_touch BEFORE UPDATE ON public.event_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_event_fin_templates_touch BEFORE UPDATE ON public.event_financial_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();