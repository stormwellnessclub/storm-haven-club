CREATE TABLE public.marketing_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  email text NOT NULL,
  event text NOT NULL CHECK (event IN ('delivered','bounced','complained','opened','clicked')),
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  last_url text,
  detail text,
  UNIQUE (campaign_id, email, event)
);
GRANT SELECT ON public.marketing_email_events TO authenticated;
GRANT ALL ON public.marketing_email_events TO service_role;
ALTER TABLE public.marketing_email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers read campaign email results" ON public.marketing_email_events
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE INDEX marketing_email_events_campaign_idx ON public.marketing_email_events (campaign_id, event);

ALTER TABLE public.email_audit_log ADD COLUMN IF NOT EXISTS provider_message_id text;
CREATE INDEX IF NOT EXISTS idx_email_audit_log_provider_msg ON public.email_audit_log (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS revenue_ledger_customer_idx ON public.revenue_ledger (stripe_customer_id, occurred_at) WHERE stripe_customer_id IS NOT NULL;

-- Service-only: record one tracking event (first/last time + count per person, campaign and event).
CREATE OR REPLACE FUNCTION public.record_marketing_email_event(p_campaign_id uuid, p_email text, p_event text, p_url text DEFAULT NULL, p_detail text DEFAULT NULL, p_at timestamptz DEFAULT now())
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.marketing_email_events (campaign_id, email, event, first_at, last_at, last_url, detail)
  VALUES (p_campaign_id, lower(btrim(p_email)), p_event, coalesce(p_at, now()), coalesce(p_at, now()), p_url, p_detail)
  ON CONFLICT (campaign_id, email, event) DO UPDATE SET
    hits = marketing_email_events.hits + 1,
    first_at = LEAST(marketing_email_events.first_at, EXCLUDED.first_at),
    last_at = GREATEST(marketing_email_events.last_at, EXCLUDED.last_at),
    last_url = coalesce(EXCLUDED.last_url, marketing_email_events.last_url),
    detail = coalesce(EXCLUDED.detail, marketing_email_events.detail);
$$;
REVOKE ALL ON FUNCTION public.record_marketing_email_event(uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketing_email_event(uuid, text, text, text, text, timestamptz) TO service_role;

-- Admin/manager: results for one campaign email. Purchases = revenue_ledger sales by the
-- recipient's Stripe customer (member or non-member record with that email) within 7 days after the send.
CREATE OR REPLACE FUNCTION public.campaign_email_results(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_type text := 'campaign_' || p_campaign_id::text; v_start timestamptz; v jsonb;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Only admins and managers can see campaign results';
  END IF;
  SELECT min(sent_at) INTO v_start FROM public.email_audit_log WHERE email_type = v_type AND status = 'sent';
  WITH recips AS (
    SELECT DISTINCT lower(recipient_email) email, max(recipient_name) name
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
    SELECT cu.email, max(cu.name) name, min(l.occurred_at) first_at, sum(l.gross_cents) gross_cents,
      string_agg(DISTINCT coalesce(nullif(l.label, ''), l.description, l.area), ' · ') items
    FROM cust cu JOIN public.revenue_ledger l ON l.stripe_customer_id = cu.cid
    WHERE v_start IS NOT NULL AND l.kind = 'sale' AND l.occurred_at >= v_start AND l.occurred_at < v_start + interval '7 days'
      AND l.stripe_invoice_id IS NULL
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
REVOKE ALL ON FUNCTION public.campaign_email_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_email_results(uuid) TO authenticated;