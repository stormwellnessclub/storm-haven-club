CREATE TABLE public.payment_renewal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('monthly_dues_3day','annual_dues_14day','annual_fee_14day','annual_fee_3day')),
  charge_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_renewal_reminders TO authenticated;
GRANT ALL ON public.payment_renewal_reminders TO service_role;

ALTER TABLE public.payment_renewal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view renewal reminders"
  ON public.payment_renewal_reminders
  FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk']::app_role[]));

CREATE INDEX idx_renewal_reminders_member ON public.payment_renewal_reminders(member_id, charge_date);