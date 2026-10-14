ALTER TABLE public.sms_campaigns ADD COLUMN IF NOT EXISTS recipient_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.phone_tail(_p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT right(regexp_replace(coalesce(_p,''), '\D', '', 'g'), 10)
$$;

CREATE OR REPLACE FUNCTION public.phone_sms_consent(_phone text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT public.phone_tail(_phone) tail)
  SELECT length((SELECT tail FROM t)) = 10 AND (
    EXISTS (SELECT 1 FROM marketing_contacts c, t WHERE public.phone_tail(c.phone) = t.tail
            AND c.opted_in_sms AND c.unsubscribed_at IS NULL)
    OR EXISTS (SELECT 1 FROM non_member_profiles n, t WHERE public.phone_tail(n.phone) = t.tail
            AND n.sms_opt_in AND n.sms_opt_out_at IS NULL)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.phone_sms_consent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_sms_consent(text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_phone_sms_consent(_phone text, _opt_in boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text := public.phone_tail(_phone);
BEGIN
  IF length(t) <> 10 THEN RETURN; END IF;
  UPDATE marketing_contacts SET opted_in_sms = _opt_in WHERE public.phone_tail(phone) = t;
  IF _opt_in THEN
    UPDATE non_member_profiles SET sms_opt_in = true, sms_opt_in_at = now(), sms_opt_in_source = 'sms_keyword', sms_opt_out_at = NULL WHERE public.phone_tail(phone) = t;
  ELSE
    UPDATE non_member_profiles SET sms_opt_in = false, sms_opt_out_at = now(), sms_opt_out_source = 'sms_keyword' WHERE public.phone_tail(phone) = t;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_phone_sms_consent(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_phone_sms_consent(text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_person_activity()
 RETURNS TABLE(person_key text, user_id uuid, email text, first_name text, last_name text, phone text, sms_opt_in boolean, audience text, member_id uuid, membership_type text, member_status text, class_count integer, class_90d integer, last_class_date date, class_type_ids uuid[], spa_count integer, massage_count integer, last_spa_date date, recovery_count integer, last_recovery_at timestamp with time zone, cafe_count integer, cafe_spend numeric, last_cafe_at timestamp with time zone, pt_count integer, last_pt_at timestamp with time zone, body_roller_sessions integer, last_checkin_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    SELECT lower(trim(c.email)), NULL::uuid, c.first_name, c.last_name, c.phone, coalesce(c.opted_in_sms,false), 3 FROM marketing_contacts c WHERE nullif(trim(c.email),'') IS NOT NULL AND c.unsubscribed_at IS NULL
  ), ppl AS (
    SELECT b.em,
      (array_agg(b.uid ORDER BY b.pri) FILTER (WHERE b.uid IS NOT NULL))[1] uid,
      (array_agg(b.fn ORDER BY b.pri) FILTER (WHERE nullif(b.fn,'') IS NOT NULL))[1] fn,
      (array_agg(b.ln ORDER BY b.pri) FILTER (WHERE nullif(b.ln,'') IS NOT NULL))[1] ln,
      (array_agg(b.ph ORDER BY b.pri) FILTER (WHERE nullif(b.ph,'') IS NOT NULL))[1] ph,
      coalesce(bool_or(b.opt) FILTER (WHERE b.pri = 1), bool_or(b.opt) FILTER (WHERE b.pri = 3), false) opt,
      bool_and(b.pri = 3) contact_only
    FROM base b WHERE b.em NOT IN (SELECT lower(bp.email) FROM blocked_persons bp WHERE bp.email IS NOT NULL)
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
END $function$;