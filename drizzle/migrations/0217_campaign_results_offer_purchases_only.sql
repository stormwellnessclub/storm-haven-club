CREATE OR REPLACE FUNCTION public.campaign_email_results(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_type text := 'campaign_' || p_campaign_id::text; v_start timestamptz; v jsonb;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Only admins and managers can see campaign results';
  END IF;
  SELECT min(sent_at) INTO v_start FROM public.email_audit_log WHERE email_type = v_type AND status = 'sent';
  WITH recips AS (
    SELECT lower(recipient_email) email, max(recipient_name) name
    FROM public.email_audit_log WHERE email_type = v_type AND status = 'sent' GROUP BY 1
  ), ev AS (
    SELECT event, count(DISTINCT email) n FROM public.marketing_email_events WHERE campaign_id = p_campaign_id GROUP BY event
  ), cust AS (
    SELECT r.email, r.name, c.cid FROM recips r
    JOIN LATERAL (
      SELECT m.stripe_customer_id cid FROM public.members m WHERE lower(m.email) = r.email AND m.stripe_customer_id IS NOT NULL
      UNION SELECT n.stripe_customer_id FROM public.non_member_profiles n WHERE lower(n.email) = r.email AND n.stripe_customer_id IS NOT NULL
    ) c ON true
  ), buys AS (
    -- Only purchases a campaign can drive (no café orders, dues, freeze or joining fees).
    SELECT cu.email, max(cu.name) name, min(l.occurred_at) first_at, sum(l.gross_cents) gross_cents,
      string_agg(DISTINCT coalesce(nullif(l.label, ''), l.description, l.area), ' · ') items
    FROM cust cu JOIN public.revenue_ledger l ON l.stripe_customer_id = cu.cid
    WHERE v_start IS NOT NULL AND l.kind = 'sale' AND l.occurred_at >= v_start AND l.occurred_at < v_start + interval '7 days'
      AND l.area IN ('pt','spa','classes','gift_cards','guest','kids_care')
    GROUP BY cu.email
  )
  SELECT jsonb_build_object(
    'started_at', v_start,
    'sent', (SELECT count(*) FROM recips),
    'delivered', coalesce((SELECT n FROM ev WHERE event = 'delivered'), 0),
    'bounced', coalesce((SELECT n FROM ev WHERE event = 'bounced'), 0),
    'complained', coalesce((SELECT n FROM ev WHERE event = 'complained'), 0),
    'opened', coalesce((SELECT n FROM ev WHERE event = 'opened'), 0),
    'clicked', coalesce((SELECT n FROM ev WHERE event = 'clicked'), 0),
    'buyers', coalesce((SELECT count(*) FROM buys), 0),
    'revenue_cents', coalesce((SELECT sum(gross_cents) FROM buys), 0),
    'buyer_list', coalesce((SELECT jsonb_agg(jsonb_build_object('email', b.email, 'name', b.name, 'first_at', b.first_at,
        'gross_cents', b.gross_cents, 'items', b.items,
        'clicked', EXISTS (SELECT 1 FROM public.marketing_email_events e WHERE e.campaign_id = p_campaign_id AND e.email = b.email AND e.event = 'clicked'))
        ORDER BY b.first_at) FROM buys b), '[]'::jsonb),
    'clicker_list', coalesce((SELECT jsonb_agg(jsonb_build_object('email', e.email, 'name', r.name, 'at', e.first_at, 'hits', e.hits, 'url', e.last_url) ORDER BY e.first_at)
        FROM public.marketing_email_events e LEFT JOIN recips r ON r.email = e.email
        WHERE e.campaign_id = p_campaign_id AND e.event = 'clicked'), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;