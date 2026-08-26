-- ============================================================
-- PHASE 2A (1/2): PT session ledger schema, guards, backfill
-- ============================================================

-- 1. SESSION USAGE LEDGER --------------------------------------------------
ALTER TABLE public.pt_session_usage
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'session_used',
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS sessions_before integer,
  ADD COLUMN IF NOT EXISTS sessions_after integer,
  ADD COLUMN IF NOT EXISTS reverses_usage_id uuid REFERENCES public.pt_session_usage(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversed_by_usage_id uuid REFERENCES public.pt_session_usage(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS pt_session_usage_idem_uidx
  ON public.pt_session_usage (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS pt_session_usage_appointment_idx
  ON public.pt_session_usage (appointment_id);

-- Backfill actor + deterministic appointment link
UPDATE public.pt_session_usage u
   SET created_by = COALESCE(u.created_by, u.used_by_admin_id)
 WHERE u.created_by IS NULL;

UPDATE public.pt_session_usage u
   SET appointment_id = a.id
  FROM public.pt_appointments a
 WHERE a.usage_id = u.id
   AND u.appointment_id IS NULL;

-- 2. APPOINTMENT CANCELLATION DETAIL --------------------------------------
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS cancel_policy_outcome text,
  ADD COLUMN IF NOT EXISTS cancel_outcome_reason text,
  ADD COLUMN IF NOT EXISTS cancel_override_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_override_reason text,
  ADD COLUMN IF NOT EXISTS cancel_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_consumed boolean NOT NULL DEFAULT false;

-- 3. RECOVERABLE PT SALE RECORD -------------------------------------------
CREATE TABLE IF NOT EXISTS public.pt_sale_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  pack_id uuid,
  pack_name text NOT NULL,
  format public.pt_format NOT NULL,
  sessions_per_pack integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  activated_at date NOT NULL,
  expires_at date NOT NULL,
  payment_method text NOT NULL DEFAULT 'offline',
  notes text,
  status text NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  amount_charged_cents integer,
  finalize_error text,
  pass_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  finalized_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.pt_sale_intents TO authenticated;
GRANT ALL ON public.pt_sale_intents TO service_role;

ALTER TABLE public.pt_sale_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage PT sale intents" ON public.pt_sale_intents;
CREATE POLICY "Staff manage PT sale intents"
  ON public.pt_sale_intents FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid()))
  WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));

CREATE INDEX IF NOT EXISTS pt_sale_intents_status_idx ON public.pt_sale_intents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS pt_sale_intents_user_idx ON public.pt_sale_intents (user_id);

CREATE OR REPLACE FUNCTION public.pt_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pt_sale_intents_touch ON public.pt_sale_intents;
CREATE TRIGGER pt_sale_intents_touch
  BEFORE UPDATE ON public.pt_sale_intents
  FOR EACH ROW EXECUTE FUNCTION public.pt_touch_updated_at();

-- 4. WRITE GUARDS ----------------------------------------------------------
-- Balance / status columns on pt_passes may only move inside a sanctioned
-- server-side function, which sets pt.ledger = 'on' for the transaction.
CREATE OR REPLACE FUNCTION public.pt_guard_pass_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ok boolean := COALESCE(current_setting('pt.ledger', true), '') = 'on';
BEGIN
  IF v_ok THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'PT_DIRECT_WRITE_BLOCKED: create PT packages with pt_finalize_package_sale()';
  END IF;

  IF NEW.sessions_remaining IS DISTINCT FROM OLD.sessions_remaining
     OR NEW.sessions_total IS DISTINCT FROM OLD.sessions_total
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'PT_DIRECT_WRITE_BLOCKED: change PT balances with pt_adjust_pass_balance() / pt_manual_consume_session()';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pt_passes_guard ON public.pt_passes;
CREATE TRIGGER pt_passes_guard
  BEFORE INSERT OR UPDATE ON public.pt_passes
  FOR EACH ROW EXECUTE FUNCTION public.pt_guard_pass_balance();

-- Usage history is append-only. Deletes are never allowed.
CREATE OR REPLACE FUNCTION public.pt_guard_session_usage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ok boolean := COALESCE(current_setting('pt.ledger', true), '') = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PT_HISTORY_IMMUTABLE: PT session history cannot be deleted; record a reversal instead';
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'PT_DIRECT_WRITE_BLOCKED: PT session usage is written only by sanctioned PT functions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pt_session_usage_guard ON public.pt_session_usage;
CREATE TRIGGER pt_session_usage_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.pt_session_usage
  FOR EACH ROW EXECUTE FUNCTION public.pt_guard_session_usage();