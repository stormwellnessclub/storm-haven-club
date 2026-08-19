DROP FUNCTION IF EXISTS public.admin_gift_card_search(text,text,text,timestamptz,timestamptz,integer,integer);

CREATE OR REPLACE FUNCTION public.admin_gift_card_search(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, code text, amount_cents integer, balance_cents integer, redeemed_cents integer, status text, derived_status text, purchase_source text, payment_method text, service_label text, hide_amount boolean, purchaser_name text, purchaser_email text, recipient_name text, recipient_email text, custom_message text, notes text, scheduled_send_at timestamp with time zone, email_sent_at timestamp with time zone, delivered_at timestamp with time zone, first_redeemed_at timestamp with time zone, expires_at timestamp with time zone, created_at timestamp with time zone, redemption_count integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
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
         f.purchase_source, f.payment_method, f.service_label, f.hide_amount, f.purchaser_name, f.purchaser_email,
         f.recipient_name, f.recipient_email, f.custom_message, f.notes,
         f.scheduled_send_at, f.email_sent_at, f.delivered_at, f.first_redeemed_at,
         f.expires_at, f.created_at, f.redemptions,
         (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(coalesce(p_limit, 200), 1) OFFSET GREATEST(coalesce(p_offset, 0), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_gift_card_search(text,text,text,timestamptz,timestamptz,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_gift_card_search(text,text,text,timestamptz,timestamptz,integer,integer) TO authenticated;