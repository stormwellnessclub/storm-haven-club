CREATE TABLE public.sms_template_overrides (
  template_key TEXT PRIMARY KEY,
  draft_body TEXT,
  published_body TEXT,
  draft_updated_at TIMESTAMPTZ,
  draft_updated_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_template_overrides TO authenticated;
GRANT ALL ON public.sms_template_overrides TO service_role;
ALTER TABLE public.sms_template_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sms template overrides"
ON public.sms_template_overrides FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));
CREATE TRIGGER sms_template_overrides_updated_at
BEFORE UPDATE ON public.sms_template_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sms_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_template_history_key ON public.sms_template_history(template_key, changed_at DESC);
GRANT SELECT, INSERT ON public.sms_template_history TO authenticated;
GRANT ALL ON public.sms_template_history TO service_role;
ALTER TABLE public.sms_template_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sms template history"
ON public.sms_template_history FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));
CREATE POLICY "Admins insert sms template history"
ON public.sms_template_history FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));