ALTER TABLE public.event_financial_communications
  DROP CONSTRAINT IF EXISTS event_financial_communications_status_check;

ALTER TABLE public.event_financial_communications
  ADD CONSTRAINT event_financial_communications_status_check
  CHECK (status IN ('draft','scheduled','sending','sent','delivered','opened','failed','bounced'));

CREATE INDEX IF NOT EXISTS event_fin_comms_scheduled_idx
  ON public.event_financial_communications(scheduled_for)
  WHERE status = 'scheduled';