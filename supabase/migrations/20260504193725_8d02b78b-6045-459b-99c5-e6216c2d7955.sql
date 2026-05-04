-- Cafe vouchers
CREATE TABLE public.cafe_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  item_id UUID REFERENCES public.cafe_menu_items(id) ON DELETE SET NULL,
  max_value_cents INTEGER,
  source_campaign_id UUID,
  source_goal_type TEXT,
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_order_id UUID,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cafe_vouchers_member ON public.cafe_vouchers(member_id);
CREATE INDEX idx_cafe_vouchers_code ON public.cafe_vouchers(code);
CREATE INDEX idx_cafe_vouchers_unredeemed ON public.cafe_vouchers(member_id) WHERE redeemed_at IS NULL;

ALTER TABLE public.cafe_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their own vouchers"
ON public.cafe_vouchers FOR SELECT
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

CREATE POLICY "Staff manage all vouchers"
ON public.cafe_vouchers FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE TRIGGER update_cafe_vouchers_updated_at
BEFORE UPDATE ON public.cafe_vouchers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cafe marketing settings (key/value)
CREATE TABLE public.cafe_marketing_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.cafe_marketing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read settings"
ON public.cafe_marketing_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff write settings"
ON public.cafe_marketing_settings FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

INSERT INTO public.cafe_marketing_settings (key, value)
VALUES ('monthly_revenue_target_cents', to_jsonb(800000))
ON CONFLICT (key) DO NOTHING;