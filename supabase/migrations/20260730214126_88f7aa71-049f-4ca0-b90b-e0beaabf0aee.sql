-- 1. Schema additions
ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS service_label text,
  ADD COLUMN IF NOT EXISTS purchase_source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_status_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_status_check
  CHECK (status = ANY (ARRAY['pending','active','scheduled','redeemed','void','expired']));

ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_payment_method_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_payment_method_check
  CHECK (payment_method = ANY (ARRAY['card_on_file','cash','clover','external','stripe_online','comp']));

ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_purchase_source_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_purchase_source_check
  CHECK (purchase_source = ANY (ARRAY['online','front_desk','admin','comp']));

CREATE INDEX IF NOT EXISTS idx_gift_cards_intent ON public.gift_cards(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code_upper ON public.gift_cards(upper(code));

-- 2. Validate a code (returns minimal info about a single card)
CREATE OR REPLACE FUNCTION public.validate_gift_card_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c public.gift_cards%ROWTYPE;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Enter a gift card code');
  END IF;

  SELECT * INTO c FROM public.gift_cards
  WHERE upper(code) = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Gift card not found');
  END IF;
  IF c.status = 'void' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card was cancelled');
  END IF;
  IF c.status IN ('pending','scheduled') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card is not active yet');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card has expired');
  END IF;
  IF c.balance_cents <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This gift card has no remaining balance');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', c.id,
    'code', c.code,
    'balance_cents', c.balance_cents,
    'amount_cents', c.amount_cents,
    'service_label', c.service_label,
    'recipient_name', c.recipient_name,
    'expires_at', c.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_gift_card_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_gift_card_code(text) TO authenticated, service_role;

-- 3. Redeem (apply) an amount from a gift card
CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_code text,
  p_amount_cents integer,
  p_applied_to_type text DEFAULT NULL,
  p_applied_to_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c public.gift_cards%ROWTYPE;
  v_apply int;
  v_new_balance int;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO c FROM public.gift_cards
  WHERE upper(code) = upper(btrim(coalesce(p_code, '')))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift card not found');
  END IF;
  IF c.status IN ('void','pending','scheduled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This gift card is not redeemable');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This gift card has expired');
  END IF;
  IF c.balance_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This gift card has no remaining balance');
  END IF;

  v_apply := LEAST(p_amount_cents, c.balance_cents);
  v_new_balance := c.balance_cents - v_apply;

  SELECT id INTO v_member_id FROM public.members
  WHERE lower(email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
  LIMIT 1;

  UPDATE public.gift_cards
  SET balance_cents = v_new_balance,
      status = CASE WHEN v_new_balance = 0 THEN 'redeemed' ELSE status END,
      first_redeemed_at = COALESCE(first_redeemed_at, now()),
      updated_at = now()
  WHERE id = c.id;

  INSERT INTO public.gift_card_redemptions (
    gift_card_id, amount_cents, balance_after_cents, applied_to_type, applied_to_id,
    redeemed_by_user_id, redeemed_by_member_id, notes
  ) VALUES (
    c.id, v_apply, v_new_balance, p_applied_to_type, p_applied_to_id,
    auth.uid(), v_member_id, p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'gift_card_id', c.id,
    'code', c.code,
    'applied_cents', v_apply,
    'balance_cents', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_gift_card(text, integer, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text, integer, text, uuid, text) TO authenticated, service_role;

-- 4. Admin search
CREATE OR REPLACE FUNCTION public.admin_gift_card_search(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, code text, amount_cents integer, balance_cents integer, redeemed_cents integer,
  status text, derived_status text, purchase_source text, payment_method text,
  service_label text, purchaser_name text, purchaser_email text,
  recipient_name text, recipient_email text, custom_message text, notes text,
  scheduled_send_at timestamptz, email_sent_at timestamptz, delivered_at timestamptz,
  first_redeemed_at timestamptz, expires_at timestamptz, created_at timestamptz,
  redemption_count integer, total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT gc.*,
      (gc.amount_cents - gc.balance_cents)::int AS redeemed_c,
      CASE
        WHEN gc.status = 'void' THEN 'cancelled'
        WHEN gc.status = 'pending' THEN 'pending'
        WHEN gc.expires_at IS NOT NULL AND gc.expires_at < now() AND gc.balance_cents > 0 THEN 'expired'
        WHEN gc.balance_cents = 0 THEN 'fully_redeemed'
        WHEN gc.balance_cents < gc.amount_cents THEN 'partially_redeemed'
        WHEN gc.status = 'scheduled' OR (gc.scheduled_send_at IS NOT NULL AND gc.email_sent_at IS NULL) THEN 'scheduled'
        WHEN gc.email_sent_at IS NOT NULL THEN 'sent'
        ELSE 'active'
      END AS derived,
      (SELECT count(*)::int FROM public.gift_card_redemptions r WHERE r.gift_card_id = gc.id) AS redemptions
    FROM public.gift_cards gc
  ), filtered AS (
    SELECT * FROM base b
    WHERE (p_search IS NULL OR btrim(p_search) = ''
           OR upper(b.code) LIKE '%' || upper(btrim(p_search)) || '%'
           OR b.recipient_name ILIKE '%' || btrim(p_search) || '%'
           OR b.recipient_email ILIKE '%' || btrim(p_search) || '%'
           OR coalesce(b.purchaser_name,'') ILIKE '%' || btrim(p_search) || '%'
           OR coalesce(b.purchaser_email,'') ILIKE '%' || btrim(p_search) || '%')
      AND (p_status IS NULL OR p_status = 'all' OR b.derived = p_status)
      AND (p_source IS NULL OR p_source = 'all' OR b.purchase_source = p_source)
      AND (p_from IS NULL OR b.created_at >= p_from)
      AND (p_to IS NULL OR b.created_at <= p_to)
  )
  SELECT f.id, f.code, f.amount_cents, f.balance_cents, f.redeemed_c, f.status, f.derived,
         f.purchase_source, f.payment_method, f.service_label, f.purchaser_name, f.purchaser_email,
         f.recipient_name, f.recipient_email, f.custom_message, f.notes,
         f.scheduled_send_at, f.email_sent_at, f.delivered_at, f.first_redeemed_at,
         f.expires_at, f.created_at, f.redemptions,
         (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(coalesce(p_limit, 200), 1) OFFSET GREATEST(coalesce(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gift_card_search(text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_gift_card_search(text, text, text, timestamptz, timestamptz, integer, integer) TO authenticated, service_role;

-- 5. Admin manage a single card
CREATE OR REPLACE FUNCTION public.admin_update_gift_card(
  p_gift_card_id uuid,
  p_expires_at timestamptz DEFAULT NULL,
  p_clear_expiry boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_void boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c public.gift_cards%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO c FROM public.gift_cards WHERE id = p_gift_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift card not found');
  END IF;

  UPDATE public.gift_cards
  SET expires_at = CASE WHEN p_clear_expiry THEN NULL WHEN p_expires_at IS NOT NULL THEN p_expires_at ELSE expires_at END,
      notes = COALESCE(p_notes, notes),
      status = CASE
                 WHEN p_void IS TRUE THEN 'void'
                 WHEN p_void IS FALSE AND status = 'void' THEN (CASE WHEN balance_cents = 0 THEN 'redeemed' ELSE 'active' END)
                 ELSE status
               END,
      updated_at = now()
  WHERE id = c.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_gift_card(uuid, timestamptz, boolean, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_gift_card(uuid, timestamptz, boolean, text, boolean) TO authenticated, service_role;

-- 6. Redemption history for one card (staff)
CREATE OR REPLACE FUNCTION public.admin_gift_card_redemptions(p_gift_card_id uuid)
RETURNS TABLE(
  id uuid, amount_cents integer, balance_after_cents integer,
  applied_to_type text, applied_to_id uuid, notes text, created_at timestamptz,
  redeemed_by_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT r.id, r.amount_cents, r.balance_after_cents, r.applied_to_type, r.applied_to_id,
         r.notes, r.created_at,
         COALESCE(NULLIF(btrim(concat(p.first_name, ' ', p.last_name)), ''), p.email, 'Staff') AS redeemed_by_name
  FROM public.gift_card_redemptions r
  LEFT JOIN public.profiles p ON p.user_id = r.redeemed_by_user_id
  WHERE r.gift_card_id = p_gift_card_id
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gift_card_redemptions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_gift_card_redemptions(uuid) TO authenticated, service_role;