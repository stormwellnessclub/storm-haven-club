-- Payment ledger integrity (payment systems audit, Oct 2026)
--
-- 1. Deleting a member must never delete their payment history: revenue and
--    sales-tax totals for past periods would silently change. Payment rows keep
--    their amounts and Stripe ids and lose only the member link.
-- 2. manual_charges.arrears_settled_at: the charge function and the
--    payment_intent webhook can both see the same membership payment; whichever
--    claims this column first applies it to arrears, so money is applied once.
-- 3. One manual_charges row per Stripe PaymentIntent, so the charge function and
--    the webhook cannot both insert the same sale. Created only when existing data
--    has no duplicates; otherwise a warning lists how many need review first.

-- 1. ON DELETE CASCADE -> ON DELETE SET NULL on the payment ledgers
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass::text AS tbl
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.members'::regclass
      AND c.conrelid IN ('public.payment_attempts'::regclass, 'public.manual_charges'::regclass)
      AND a.attname = 'member_id'
      AND c.confdeltype = 'c' -- CASCADE
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL',
      r.tbl, r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.payment_attempts ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.manual_charges ALTER COLUMN member_id DROP NOT NULL;

-- 2. Arrears settlement claim
ALTER TABLE public.manual_charges
  ADD COLUMN IF NOT EXISTS arrears_settled_at timestamptz;

COMMENT ON COLUMN public.manual_charges.arrears_settled_at IS
  'Set when this charge was applied to membership arrears. Claimed atomically so a payment is applied once.';

-- 3. One row per PaymentIntent
DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT stripe_payment_intent_id
    FROM public.manual_charges
    WHERE stripe_payment_intent_id IS NOT NULL
    GROUP BY stripe_payment_intent_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS manual_charges_payment_intent_unique
      ON public.manual_charges (stripe_payment_intent_id)
      WHERE stripe_payment_intent_id IS NOT NULL;
  ELSE
    RAISE WARNING 'manual_charges has % payment intents recorded more than once; unique index NOT created. Review with: SELECT stripe_payment_intent_id, count(*) FROM manual_charges WHERE stripe_payment_intent_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;', v_dupes;
  END IF;
END $$;
