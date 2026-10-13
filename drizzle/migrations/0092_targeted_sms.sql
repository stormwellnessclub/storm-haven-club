CREATE TABLE public.sms_class_template_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  class_type_id uuid NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, class_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_class_template_overrides TO authenticated;
GRANT ALL ON public.sms_class_template_overrides TO service_role;
ALTER TABLE public.sms_class_template_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage class sms overrides" ON public.sms_class_template_overrides FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TABLE public.audience_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_segments TO authenticated;
GRANT ALL ON public.audience_segments TO service_role;
ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage segments" ON public.audience_segments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS segment_id uuid,
  ADD COLUMN IF NOT EXISTS filters jsonb,
  ADD COLUMN IF NOT EXISTS recipient_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error text;

CREATE OR REPLACE FUNCTION public.arm_sms_campaign(_id uuid, _send_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE t timestamptz := _send_at AT TIME ZONE 'UTC';
BEGIN
  PERFORM cron.schedule('sms-camp-' || _id::text,
    format('%s %s %s %s *', extract(minute from t)::int, extract(hour from t)::int, extract(day from t)::int, extract(month from t)::int),
    $c$select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/run-sms-campaign-scheduled', headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxem1yZHp3Z3N1amdianFwb3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDA4MzksImV4cCI6MjA4MjMxNjgzOX0.kPt7tgmDQy5sQ1aDGFzi43dNYcqDE4fMDJnZ8-c2_1o"}'::jsonb, body:='{}'::jsonb, timeout_milliseconds:=300000);$c$);
END $f$;

CREATE OR REPLACE FUNCTION public.unschedule_sms_campaign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  PERFORM cron.unschedule('sms-camp-' || _id::text);
EXCEPTION WHEN others THEN NULL;
END $f$;
REVOKE ALL ON FUNCTION public.arm_sms_campaign(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unschedule_sms_campaign(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arm_sms_campaign(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.unschedule_sms_campaign(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_person_activity()
RETURNS TABLE (
  person_key text, user_id uuid, email text, first_name text, last_name text, phone text,
  sms_opt_in boolean, audience text, member_id uuid, membership_type text, member_status text,
  class_count int, class_90d int, last_class_date date, class_type_ids uuid[],
  spa_count int, massage_count int, last_spa_date date,
  recovery_count int, last_recovery_at timestamptz,
  cafe_count int, cafe_spend numeric, last_cafe_at timestamptz,
  pt_count int, last_pt_at timestamptz,
  body_roller_sessions int, last_checkin_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT lower(trim(p.email)) em, p.user_id uid, p.first_name fn, p.last_name ln, p.phone ph, coalesce(p.sms_opt_in,false) opt, 1 pri FROM profiles p WHERE nullif(trim(p.email),'') IS NOT NULL
    UNION ALL
    SELECT lower(trim(m.email)), m.user_id, m.first_name, m.last_name, m.phone, NULL::boolean, 2 FROM members m WHERE nullif(trim(m.email),'') IS NOT NULL
    UNION ALL
    SELECT lower(trim(c.email)), NULL::uuid, c.first_name, c.last_name, c.phone, NULL::boolean, 3 FROM marketing_contacts c WHERE nullif(trim(c.email),'') IS NOT NULL AND c.unsubscribed_at IS NULL
  ), ppl AS (
    SELECT b.em,
      (array_agg(b.uid ORDER BY b.pri) FILTER (WHERE b.uid IS NOT NULL))[1] uid,
      (array_agg(b.fn ORDER BY b.pri) FILTER (WHERE nullif(b.fn,'') IS NOT NULL))[1] fn,
      (array_agg(b.ln ORDER BY b.pri) FILTER (WHERE nullif(b.ln,'') IS NOT NULL))[1] ln,
      (array_agg(b.ph ORDER BY b.pri) FILTER (WHERE nullif(b.ph,'') IS NOT NULL))[1] ph,
      coalesce(bool_or(b.opt) FILTER (WHERE b.pri = 1), false) opt,
      bool_and(b.pri = 3) contact_only
    FROM base b WHERE b.em NOT IN (SELECT lower(email) FROM blocked_persons WHERE email IS NOT NULL)
    GROUP BY b.em
  ), mem AS (
    SELECT DISTINCT ON (lower(trim(m.email))) lower(trim(m.email)) em, m.id, m.user_id, m.membership_type, m.status
    FROM members m WHERE m.status <> 'cancelled' AND m.records_cancelled_at IS NULL AND m.email IS NOT NULL
    ORDER BY lower(trim(m.email)), m.created_at DESC
  ), cls AS (
    SELECT cb.user_id u, count(*)::int n, count(*) FILTER (WHERE s.session_date >= (now() AT TIME ZONE 'America/Detroit')::date - 90)::int n90,
      max(s.session_date) last_d, array_agg(DISTINCT s.class_type_id) FILTER (WHERE s.class_type_id IS NOT NULL) types
    FROM class_bookings cb JOIN class_sessions s ON s.id = cb.session_id
    WHERE cb.user_id IS NOT NULL AND cb.status IN ('confirmed','completed') GROUP BY cb.user_id
  ), spa AS (
    SELECT a.user_id u, count(*)::int n,
      count(*) FILTER (WHERE a.service_category ILIKE '%massage%' OR a.service_name ILIKE '%massage%')::int massage,
      count(*) FILTER (WHERE a.service_category ILIKE '%recover%')::int rec,
      max(a.appointment_date) last_d,
      max(a.appointment_date::timestamptz) FILTER (WHERE a.service_category ILIKE '%recover%') last_rec
    FROM spa_appointments a WHERE a.user_id IS NOT NULL AND coalesce(a.status,'') NOT IN ('cancelled','no_show') GROUP BY a.user_id
  ), amen AS (
    SELECT l.user_id u, count(*)::int n, max(l.used_at) last_at FROM amenity_usage_logs l WHERE l.user_id IS NOT NULL GROUP BY l.user_id
  ), cafe AS (
    SELECT o.user_id u, count(*)::int n, coalesce(sum(o.total_amount),0) spend, max(o.created_at) last_at
    FROM cafe_orders o WHERE o.user_id IS NOT NULL AND coalesce(o.status,'') NOT IN ('cancelled','failed','refunded','pending_payment') GROUP BY o.user_id
  ), pt AS (
    SELECT a.user_id u, count(*)::int n, max(a.starts_at) last_at FROM pt_appointments a
    WHERE a.user_id IS NOT NULL AND a.status::text IN ('scheduled','completed') GROUP BY a.user_id
  ), br AS (
    SELECT lower(trim(b.customer_email)) em, sum(b.sessions_total)::int n FROM body_roller_presale_purchases b
    WHERE b.status = 'paid' AND b.customer_email IS NOT NULL GROUP BY 1
  ), chk AS (
    SELECT m.user_id u, max(c.checked_in_at) last_at FROM check_ins c JOIN members m ON m.id = c.member_id WHERE m.user_id IS NOT NULL GROUP BY m.user_id
  )
  SELECT p.em, coalesce(p.uid, mem.user_id), p.em, p.fn, p.ln, p.ph, p.opt,
    CASE WHEN mem.id IS NOT NULL THEN 'member' WHEN p.contact_only THEN 'contact' ELSE 'non_member' END,
    mem.id, mem.membership_type, mem.status,
    coalesce(cls.n,0), coalesce(cls.n90,0), cls.last_d, coalesce(cls.types,'{}'),
    coalesce(spa.n,0), coalesce(spa.massage,0), spa.last_d,
    coalesce(spa.rec,0) + coalesce(amen.n,0), greatest(spa.last_rec, amen.last_at),
    coalesce(cafe.n,0), coalesce(cafe.spend,0), cafe.last_at,
    coalesce(pt.n,0), pt.last_at,
    coalesce(br.n,0), chk.last_at
  FROM ppl p
  LEFT JOIN mem ON mem.em = p.em
  LEFT JOIN cls ON cls.u = coalesce(p.uid, mem.user_id)
  LEFT JOIN spa ON spa.u = coalesce(p.uid, mem.user_id)
  LEFT JOIN amen ON amen.u = coalesce(p.uid, mem.user_id)
  LEFT JOIN cafe ON cafe.u = coalesce(p.uid, mem.user_id)
  LEFT JOIN pt ON pt.u = coalesce(p.uid, mem.user_id)
  LEFT JOIN br ON br.em = p.em
  LEFT JOIN chk ON chk.u = coalesce(p.uid, mem.user_id)
  ORDER BY p.em;
END $f$;
REVOKE ALL ON FUNCTION public.admin_person_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_person_activity() TO authenticated, service_role;