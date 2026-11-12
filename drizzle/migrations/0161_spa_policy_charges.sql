ALTER TABLE public.spa_services ADD COLUMN IF NOT EXISTS late_cancel_fee_cents integer CHECK (late_cancel_fee_cents IS NULL OR late_cancel_fee_cents > 0);
COMMENT ON COLUMN public.spa_services.late_cancel_fee_cents IS 'Flat fee for a client cancellation within 24 hours. NULL = the general spa policy (handled by staff).';

CREATE TABLE IF NOT EXISTS public.spa_policy_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('late_cancel','no_show')),
  user_id uuid,
  member_id uuid,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  processing_fee_cents integer,
  status text NOT NULL DEFAULT 'owed' CHECK (status IN ('owed','charging','charged','failed','waived','voided')),
  payment_intent_id text,
  last_error text,
  charged_at timestamptz,
  resolved_by uuid,
  resolved_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, kind)
);
CREATE INDEX IF NOT EXISTS spa_policy_charges_status_idx ON public.spa_policy_charges (status, created_at DESC);

GRANT SELECT, UPDATE ON public.spa_policy_charges TO authenticated;
GRANT ALL ON public.spa_policy_charges TO service_role;
ALTER TABLE public.spa_policy_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own spa policy charges" ON public.spa_policy_charges FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Spa staff view spa policy charges" ON public.spa_policy_charges FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]));
CREATE POLICY "Managers waive spa policy charges" ON public.spa_policy_charges FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]) AND status IN ('owed','failed'))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]) AND status = 'waived' AND resolved_by = auth.uid());

-- Late client cancellations and no-shows on services with their own policy record what is owed.
CREATE OR REPLACE FUNCTION public.record_spa_policy_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fee integer;
  v_start timestamptz;
  v_amount integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  -- Undoing a cancellation or no-show cancels anything not yet collected.
  IF OLD.status IN ('cancelled','no_show') THEN
    UPDATE public.spa_policy_charges SET status = 'voided', updated_at = now()
     WHERE appointment_id = NEW.id AND kind = CASE OLD.status WHEN 'cancelled' THEN 'late_cancel' ELSE 'no_show' END
       AND status IN ('owed','failed');
  END IF;

  SELECT s.late_cancel_fee_cents INTO v_fee FROM public.spa_services s WHERE s.id::text = NEW.service_id::text;
  IF v_fee IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'cancelled' THEN
    v_start := (NEW.appointment_date + NEW.appointment_time) AT TIME ZONE 'America/Detroit';
    IF v_start - now() >= interval '24 hours' THEN RETURN NEW; END IF;
    -- Only the client's own cancellation; staff cancellations are the club's decision.
    IF auth.uid() IS NULL OR NEW.user_id IS NULL OR auth.uid() <> NEW.user_id
       OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.spa_policy_charges (appointment_id, kind, user_id, member_id, amount_cents)
    VALUES (NEW.id, 'late_cancel', NEW.user_id, NEW.member_id, v_fee)
    ON CONFLICT (appointment_id, kind) DO UPDATE SET status = 'owed', amount_cents = EXCLUDED.amount_cents, updated_at = now()
      WHERE public.spa_policy_charges.status = 'voided';
  ELSIF NEW.status = 'no_show' THEN
    -- A prepaid series session is simply used up.
    IF NEW.client_package_id IS NOT NULL THEN RETURN NEW; END IF;
    v_amount := greatest(round(coalesce(NEW.member_price, NEW.service_price, 0) * 100)::integer - round(coalesce(NEW.amount_paid, 0) * 100)::integer, 0);
    IF v_amount <= 0 THEN RETURN NEW; END IF;
    INSERT INTO public.spa_policy_charges (appointment_id, kind, user_id, member_id, amount_cents)
    VALUES (NEW.id, 'no_show', NEW.user_id, NEW.member_id, v_amount)
    ON CONFLICT (appointment_id, kind) DO UPDATE SET status = 'owed', amount_cents = EXCLUDED.amount_cents, updated_at = now()
      WHERE public.spa_policy_charges.status = 'voided';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS spa_appointments_policy_charge ON public.spa_appointments;
CREATE TRIGGER spa_appointments_policy_charge AFTER UPDATE OF status ON public.spa_appointments
  FOR EACH ROW EXECUTE FUNCTION public.record_spa_policy_charge();