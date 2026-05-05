
-- Voucher status enum
DO $$ BEGIN
  CREATE TYPE public.mothers_day_voucher_status AS ENUM ('pending', 'active', 'redeemed', 'expired', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Code generator: MOM-XXXXXX (uppercase alphanumeric, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_mothers_day_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'MOM-';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Main table
CREATE TABLE IF NOT EXISTS public.mothers_day_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL DEFAULT public.generate_mothers_day_code(),
  buyer_user_id uuid,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  recipient_name text,
  recipient_email text,
  gift_message text,
  massage_choice text,
  massage_duration int NOT NULL CHECK (massage_duration IN (60, 90)),
  amount_paid_cents int NOT NULL DEFAULT 0,
  stripe_payment_intent_id text,
  stripe_session_id text,
  status public.mothers_day_voucher_status NOT NULL DEFAULT 'pending',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 months'),
  redeemed_at timestamptz,
  redeemed_appointment_id uuid,
  redeemed_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_code ON public.mothers_day_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_buyer_email ON public.mothers_day_vouchers(lower(buyer_email));
CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_recipient_email ON public.mothers_day_vouchers(lower(recipient_email));
CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_status ON public.mothers_day_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_mothers_day_vouchers_session ON public.mothers_day_vouchers(stripe_session_id);

CREATE TRIGGER trg_mothers_day_vouchers_updated_at
BEFORE UPDATE ON public.mothers_day_vouchers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mothers_day_vouchers ENABLE ROW LEVEL SECURITY;

-- Buyers (matched by email) can view their own vouchers
CREATE POLICY "Buyers view own vouchers"
ON public.mothers_day_vouchers FOR SELECT
TO authenticated
USING (lower(buyer_email) = public.current_user_email_lower());

-- Recipients (matched by email) can view vouchers gifted to them
CREATE POLICY "Recipients view gifted vouchers"
ON public.mothers_day_vouchers FOR SELECT
TO authenticated
USING (recipient_email IS NOT NULL AND lower(recipient_email) = public.current_user_email_lower());

-- Staff/admins full access
CREATE POLICY "Staff view all vouchers"
ON public.mothers_day_vouchers FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[]));

CREATE POLICY "Staff update vouchers"
ON public.mothers_day_vouchers FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[]));

CREATE POLICY "Staff insert vouchers"
ON public.mothers_day_vouchers FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));

-- Atomic redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_mothers_day_voucher(
  p_code text,
  p_appointment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher public.mothers_day_vouchers%ROWTYPE;
BEGIN
  SELECT * INTO v_voucher
  FROM public.mothers_day_vouchers
  WHERE upper(code) = upper(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher not found');
  END IF;

  IF v_voucher.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher already redeemed', 'redeemed_at', v_voucher.redeemed_at);
  END IF;

  IF v_voucher.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher is ' || v_voucher.status::text);
  END IF;

  IF v_voucher.expires_at < now() THEN
    UPDATE public.mothers_day_vouchers SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'Voucher has expired');
  END IF;

  UPDATE public.mothers_day_vouchers
  SET status = 'redeemed',
      redeemed_at = now(),
      redeemed_appointment_id = p_appointment_id,
      redeemed_by_user_id = auth.uid()
  WHERE id = v_voucher.id;

  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'massage_choice', v_voucher.massage_choice,
    'massage_duration', v_voucher.massage_duration,
    'recipient_name', v_voucher.recipient_name,
    'buyer_name', v_voucher.buyer_name
  );
END;
$$;

-- Lookup RPC (public-readable details for voucher code validation at booking)
CREATE OR REPLACE FUNCTION public.lookup_mothers_day_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.mothers_day_vouchers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.mothers_day_vouchers WHERE upper(code) = upper(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'status', v.status,
    'massage_choice', v.massage_choice,
    'massage_duration', v.massage_duration,
    'recipient_name', v.recipient_name,
    'expires_at', v.expires_at,
    'expired', v.expires_at < now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_mothers_day_voucher(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_mothers_day_voucher(text) TO authenticated, anon;
