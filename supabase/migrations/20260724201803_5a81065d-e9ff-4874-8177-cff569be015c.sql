
-- 1. New columns
ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_redeemed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gift_cards_scheduled
  ON public.gift_cards (scheduled_send_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser_user
  ON public.gift_cards (purchaser_user_id);

-- 2. Trigger: stamp first_redeemed_at on first redemption
CREATE OR REPLACE FUNCTION public.gift_card_stamp_first_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gift_cards
     SET first_redeemed_at = COALESCE(first_redeemed_at, NEW.created_at),
         updated_at = now()
   WHERE id = NEW.gift_card_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_card_first_redemption ON public.gift_card_redemptions;
CREATE TRIGGER trg_gift_card_first_redemption
AFTER INSERT ON public.gift_card_redemptions
FOR EACH ROW EXECUTE FUNCTION public.gift_card_stamp_first_redemption();

-- 3. RPC: get_my_gift_cards — cards purchased by the current member
CREATE OR REPLACE FUNCTION public.get_my_gift_cards()
RETURNS TABLE (
  id uuid,
  code text,
  amount_cents integer,
  balance_cents integer,
  redeemed_cents integer,
  redemption_count integer,
  status text,
  recipient_name text,
  recipient_email text,
  custom_message text,
  scheduled_send_at timestamptz,
  email_sent_at timestamptz,
  delivered_at timestamptz,
  first_redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  payment_method text,
  delivery_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    gc.id,
    gc.code,
    gc.amount_cents,
    gc.balance_cents,
    (gc.amount_cents - gc.balance_cents)::int AS redeemed_cents,
    COALESCE((SELECT count(*)::int FROM public.gift_card_redemptions r WHERE r.gift_card_id = gc.id), 0) AS redemption_count,
    gc.status,
    gc.recipient_name,
    gc.recipient_email,
    gc.custom_message,
    gc.scheduled_send_at,
    gc.email_sent_at,
    gc.delivered_at,
    gc.first_redeemed_at,
    gc.expires_at,
    gc.created_at,
    gc.payment_method,
    CASE
      WHEN gc.status = 'scheduled' THEN 'scheduled'
      WHEN gc.delivered_at IS NOT NULL THEN 'delivered'
      WHEN gc.email_sent_at IS NOT NULL THEN 'sent'
      ELSE 'pending'
    END AS delivery_status
  FROM public.gift_cards gc
  WHERE gc.purchaser_user_id = auth.uid()
     OR (v_email IS NOT NULL AND lower(gc.purchaser_email) = v_email)
  ORDER BY gc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_gift_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_gift_cards() TO authenticated;

-- 4. RPC: cancel_scheduled_gift_card
CREATE OR REPLACE FUNCTION public.cancel_scheduled_gift_card(p_gift_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.gift_cards%ROWTYPE;
  v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_card FROM public.gift_cards WHERE id = p_gift_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift card not found');
  END IF;

  IF v_card.purchaser_user_id IS DISTINCT FROM auth.uid()
     AND (v_email IS NULL OR lower(COALESCE(v_card.purchaser_email,'')) <> v_email)
     AND NOT public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'front_desk'::app_role]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_card.status <> 'scheduled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only scheduled gift cards can be cancelled here. Contact staff for a refund.');
  END IF;

  UPDATE public.gift_cards
     SET status = 'void',
         balance_cents = 0,
         updated_at = now()
   WHERE id = p_gift_card_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_gift_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_gift_card(uuid) TO authenticated;

-- 5. RPC: reschedule_gift_card
CREATE OR REPLACE FUNCTION public.reschedule_gift_card(p_gift_card_id uuid, p_new_time timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.gift_cards%ROWTYPE;
  v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_card FROM public.gift_cards WHERE id = p_gift_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift card not found');
  END IF;

  IF v_card.purchaser_user_id IS DISTINCT FROM auth.uid()
     AND (v_email IS NULL OR lower(COALESCE(v_card.purchaser_email,'')) <> v_email)
     AND NOT public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'front_desk'::app_role]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_card.status <> 'scheduled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only scheduled gift cards can be rescheduled');
  END IF;

  IF p_new_time <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'New send time must be in the future');
  END IF;

  UPDATE public.gift_cards
     SET scheduled_send_at = p_new_time,
         updated_at = now()
   WHERE id = p_gift_card_id;

  RETURN jsonb_build_object('success', true, 'scheduled_send_at', p_new_time);
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_gift_card(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_gift_card(uuid, timestamptz) TO authenticated;
