CREATE TABLE IF NOT EXISTS public.pending_class_pass_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('class_pass','mothers_day_pack')),
  category TEXT,
  pass_type TEXT,
  is_member BOOLEAN NOT NULL DEFAULT false,
  is_gift BOOLEAN NOT NULL DEFAULT false,
  gift_recipient_email TEXT,
  gift_recipient_name TEXT,
  amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired','recovered')),
  reminders_sent INTEGER NOT NULL DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_cp_status_created ON public.pending_class_pass_checkouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pending_cp_email ON public.pending_class_pass_checkouts(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_pending_cp_pi ON public.pending_class_pass_checkouts(stripe_payment_intent_id);

ALTER TABLE public.pending_class_pass_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pending checkouts"
ON public.pending_class_pass_checkouts FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins can update pending checkouts"
ON public.pending_class_pass_checkouts FOR UPDATE
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE POLICY "Admins can delete pending checkouts"
ON public.pending_class_pass_checkouts FOR DELETE
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

CREATE TRIGGER trg_pending_cp_updated_at
BEFORE UPDATE ON public.pending_class_pass_checkouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();