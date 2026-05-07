
-- 1. Idempotency column
ALTER TABLE public.class_passes
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_passes_stripe_pi
  ON public.class_passes(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 2. Allow null user_id for unclaimed gift passes
ALTER TABLE public.class_passes ALTER COLUMN user_id DROP NOT NULL;

-- 3. RLS: let recipients view their unclaimed gift by email; let staff already covered.
DROP POLICY IF EXISTS "Recipients can view unclaimed gift passes" ON public.class_passes;
CREATE POLICY "Recipients can view unclaimed gift passes"
ON public.class_passes
FOR SELECT
TO authenticated
USING (
  user_id IS NULL
  AND gift_recipient_email IS NOT NULL
  AND lower(gift_recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

-- 4. Claim RPC
CREATE OR REPLACE FUNCTION public.claim_mothers_day_pack(_email text)
RETURNS TABLE(claimed_count integer, pass_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_jwt_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_target_email text := lower(coalesce(_email, ''));
  v_ids uuid[];
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_target_email = '' OR v_target_email <> v_jwt_email THEN
    RAISE EXCEPTION 'email mismatch';
  END IF;

  SELECT id INTO v_member_id FROM public.members
    WHERE lower(email) = v_target_email AND status = 'active' LIMIT 1;

  WITH upd AS (
    UPDATE public.class_passes
       SET user_id = v_uid,
           member_id = COALESCE(member_id, v_member_id),
           gift_verification_status = CASE
             WHEN v_member_id IS NOT NULL THEN 'auto'
             ELSE gift_verification_status
           END,
           updated_at = now()
     WHERE user_id IS NULL
       AND gift_recipient_email IS NOT NULL
       AND lower(gift_recipient_email) = v_target_email
       AND promo_code = 'mothers_day_2026'
    RETURNING id
  )
  SELECT array_agg(id) INTO v_ids FROM upd;

  RETURN QUERY SELECT COALESCE(array_length(v_ids,1),0)::int, COALESCE(v_ids, ARRAY[]::uuid[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mothers_day_pack(text) TO authenticated;

-- 5. Auto-claim on signup
CREATE OR REPLACE FUNCTION public.auto_claim_mothers_day_packs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_member_id uuid;
BEGIN
  IF v_email = '' THEN RETURN NEW; END IF;

  SELECT id INTO v_member_id FROM public.members
    WHERE lower(email) = v_email AND status = 'active' LIMIT 1;

  UPDATE public.class_passes
     SET user_id = NEW.id,
         member_id = COALESCE(member_id, v_member_id),
         gift_verification_status = CASE
           WHEN v_member_id IS NOT NULL THEN 'auto'
           ELSE gift_verification_status
         END,
         updated_at = now()
   WHERE user_id IS NULL
     AND gift_recipient_email IS NOT NULL
     AND lower(gift_recipient_email) = v_email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_claim_mothers_day_packs_trigger ON auth.users;
CREATE TRIGGER auto_claim_mothers_day_packs_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_claim_mothers_day_packs();
