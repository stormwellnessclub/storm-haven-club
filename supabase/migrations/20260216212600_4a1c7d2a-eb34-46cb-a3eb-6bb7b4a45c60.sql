
-- Guest services/charges table to track services provided to guests
CREATE TABLE public.guest_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_pass_id UUID REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  guest_email TEXT,
  guest_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  charged_by UUID,
  notes TEXT,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_services ENABLE ROW LEVEL SECURITY;

-- Staff can manage guest services
CREATE POLICY "Staff can view guest services"
  ON public.guest_services FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

CREATE POLICY "Staff can create guest services"
  ON public.guest_services FOR INSERT
  TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

CREATE POLICY "Staff can update guest services"
  ON public.guest_services FOR UPDATE
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- Add card metadata columns to guest_passes for saved cards
ALTER TABLE public.guest_passes 
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_exp_month INTEGER,
  ADD COLUMN IF NOT EXISTS card_exp_year INTEGER;
