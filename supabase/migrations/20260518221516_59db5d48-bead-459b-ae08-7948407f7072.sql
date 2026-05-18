
CREATE UNIQUE INDEX IF NOT EXISTS class_passes_stripe_pi_unique
  ON public.class_passes (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text NOT NULL,
  product_kind text NOT NULL,
  action text NOT NULL,
  detail jsonb,
  class_pass_id uuid REFERENCES public.class_passes(id) ON DELETE SET NULL,
  user_id uuid,
  customer_email text,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_reconciliations_pi_idx
  ON public.payment_reconciliations (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS payment_reconciliations_created_idx
  ON public.payment_reconciliations (created_at DESC);

ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read reconciliations" ON public.payment_reconciliations;
CREATE POLICY "Admins read reconciliations"
  ON public.payment_reconciliations FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.prevent_non_member_for_active_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = NEW.user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot create non_member_profiles row for user_id % - already an active member', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_prevent_non_member_for_active_member ON public.non_member_profiles;
CREATE TRIGGER trg_prevent_non_member_for_active_member
  BEFORE INSERT OR UPDATE OF user_id ON public.non_member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_non_member_for_active_member();
