ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS tip_cents integer NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  ADD COLUMN IF NOT EXISTS spa_service_id uuid REFERENCES public.spa_services(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS public.get_my_gift_cards();
CREATE FUNCTION public.get_my_gift_cards()
 RETURNS TABLE(id uuid, code text, amount_cents integer, balance_cents integer, redeemed_cents integer, redemption_count integer, status text, recipient_name text, recipient_email text, custom_message text, scheduled_send_at timestamptz, email_sent_at timestamptz, delivered_at timestamptz, first_redeemed_at timestamptz, expires_at timestamptz, created_at timestamptz, payment_method text, delivery_status text, service_label text, tip_cents integer, hide_amount boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  RETURN QUERY
  SELECT gc.id, gc.code, gc.amount_cents, gc.balance_cents,
    (gc.amount_cents - gc.balance_cents)::int,
    COALESCE((SELECT count(*)::int FROM public.gift_card_redemptions r WHERE r.gift_card_id = gc.id), 0),
    gc.status, gc.recipient_name, gc.recipient_email, gc.custom_message, gc.scheduled_send_at,
    gc.email_sent_at, gc.delivered_at, gc.first_redeemed_at, gc.expires_at, gc.created_at, gc.payment_method,
    CASE WHEN gc.status = 'scheduled' THEN 'scheduled'
         WHEN gc.delivered_at IS NOT NULL THEN 'delivered'
         WHEN gc.email_sent_at IS NOT NULL THEN 'sent'
         ELSE 'pending' END,
    gc.service_label, gc.tip_cents, gc.hide_amount
  FROM public.gift_cards gc
  WHERE gc.status <> 'pending'
    AND (gc.purchaser_user_id = auth.uid() OR (v_email IS NOT NULL AND lower(gc.purchaser_email) = v_email))
  ORDER BY gc.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_gift_cards() TO authenticated;