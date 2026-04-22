ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS next_billing_date date,
  ADD COLUMN IF NOT EXISTS next_annual_fee_date date;

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS non_member_profile_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'payment_attempts'
      AND constraint_name = 'payment_attempts_non_member_profile_id_fkey'
  ) THEN
    ALTER TABLE public.payment_attempts
      ADD CONSTRAINT payment_attempts_non_member_profile_id_fkey
      FOREIGN KEY (non_member_profile_id)
      REFERENCES public.non_member_profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_non_member_profile_id
  ON public.payment_attempts(non_member_profile_id);

CREATE OR REPLACE FUNCTION public.mark_superseded_failed_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND NEW.member_id IS NOT NULL THEN
    UPDATE public.payment_attempts
    SET
      superseded_by_attempt_id = NEW.id,
      superseded_at = now(),
      resolved_at = COALESCE(resolved_at, now()),
      resolution_note = COALESCE(resolution_note, 'superseded_by_retry')
    WHERE member_id = NEW.member_id
      AND id <> NEW.id
      AND status IN ('failed', 'requires_action')
      AND superseded_at IS NULL
      AND (
        (NEW.stripe_invoice_id IS NOT NULL AND stripe_invoice_id = NEW.stripe_invoice_id)
        OR (
          NEW.stripe_invoice_id IS NULL
          AND stripe_invoice_id IS NULL
          AND amount = NEW.amount
          AND created_at >= NEW.created_at - interval '10 minutes'
          AND created_at <= NEW.created_at
        )
      );

    IF NEW.stripe_invoice_id IS NOT NULL THEN
      UPDATE public.billing_arrears
      SET status = 'paid',
          paid_at = COALESCE(paid_at, now()),
          updated_at = now()
      WHERE stripe_invoice_id = NEW.stripe_invoice_id
        AND member_id = NEW.member_id
        AND status IN ('unpaid', 'partial');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.payment_attempts AS failed
SET superseded_by_attempt_id = succeeded.id,
    superseded_at = COALESCE(failed.superseded_at, now()),
    resolved_at = COALESCE(failed.resolved_at, now()),
    resolution_note = COALESCE(failed.resolution_note, 'superseded_by_retry')
FROM public.payment_attempts AS succeeded
WHERE failed.member_id = succeeded.member_id
  AND failed.id <> succeeded.id
  AND failed.status IN ('failed', 'requires_action')
  AND succeeded.status = 'succeeded'
  AND failed.superseded_at IS NULL
  AND (
    (succeeded.stripe_invoice_id IS NOT NULL AND failed.stripe_invoice_id = succeeded.stripe_invoice_id)
    OR (
      succeeded.stripe_invoice_id IS NULL
      AND failed.stripe_invoice_id IS NULL
      AND failed.amount = succeeded.amount
      AND failed.created_at >= succeeded.created_at - interval '10 minutes'
      AND failed.created_at <= succeeded.created_at
    )
  );

UPDATE public.billing_arrears AS ba
SET status = 'paid',
    paid_at = COALESCE(ba.paid_at, now()),
    updated_at = now()
FROM public.payment_attempts AS pa
WHERE pa.status = 'succeeded'
  AND pa.member_id IS NOT NULL
  AND pa.stripe_invoice_id IS NOT NULL
  AND ba.member_id = pa.member_id
  AND ba.stripe_invoice_id = pa.stripe_invoice_id
  AND ba.status IN ('unpaid', 'partial');