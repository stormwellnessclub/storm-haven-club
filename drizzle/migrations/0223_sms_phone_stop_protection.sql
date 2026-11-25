CREATE OR REPLACE FUNCTION public.set_phone_sms_consent(_phone text, _opt_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t text := public.phone_tail(_phone);
BEGIN
 IF length(t) <> 10 THEN RETURN; END IF;
 UPDATE marketing_contacts SET opted_in_sms=_opt_in WHERE public.phone_tail(phone)=t;
 UPDATE profiles SET sms_opt_in=_opt_in, sms_opt_in_at=CASE WHEN _opt_in THEN now() ELSE sms_opt_in_at END, sms_opt_in_source=CASE WHEN _opt_in THEN 'sms_keyword' ELSE sms_opt_in_source END, sms_opt_out_at=CASE WHEN _opt_in THEN NULL ELSE now() END, sms_opt_out_source=CASE WHEN _opt_in THEN NULL ELSE 'sms_keyword' END WHERE public.phone_tail(phone)=t;
 UPDATE non_member_profiles SET sms_opt_in=_opt_in, sms_opt_in_at=CASE WHEN _opt_in THEN now() ELSE sms_opt_in_at END, sms_opt_in_source=CASE WHEN _opt_in THEN 'sms_keyword' ELSE sms_opt_in_source END, sms_opt_out_at=CASE WHEN _opt_in THEN NULL ELSE now() END, sms_opt_out_source=CASE WHEN _opt_in THEN NULL ELSE 'sms_keyword' END WHERE public.phone_tail(phone)=t;
 UPDATE spa_guest_sms_consent SET opted_in=_opt_in WHERE public.phone_tail(phone)=t;
END $$;
CREATE OR REPLACE FUNCTION public.sms_phone_is_blocked(_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH t AS (SELECT public.phone_tail(_phone) tail), restart AS (SELECT max(created_at) at FROM sms_consent_log l,t WHERE public.phone_tail(l.phone)=t.tail AND l.action='opt_in' AND l.source='sms_keyword'), stopped AS (SELECT max(at) at FROM (SELECT m.created_at at FROM sms_messages m,t WHERE public.phone_tail(m.phone)=t.tail AND m.error_code='21610' UNION ALL SELECT l.created_at FROM sms_consent_log l,t WHERE public.phone_tail(l.phone)=t.tail AND l.action='opt_out' AND l.source IN ('sms_keyword','twilio_21610','twilio_export')) s)
SELECT length((SELECT tail FROM t))<>10 OR coalesce((SELECT at FROM stopped) >= coalesce((SELECT at FROM restart),'-infinity'::timestamptz),false) OR EXISTS(SELECT 1 FROM profiles p,t WHERE public.phone_tail(p.phone)=t.tail AND NOT coalesce(p.sms_opt_in,false) AND p.sms_opt_out_at IS NOT NULL) OR EXISTS(SELECT 1 FROM non_member_profiles p,t WHERE public.phone_tail(p.phone)=t.tail AND NOT coalesce(p.sms_opt_in,false) AND p.sms_opt_out_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.sms_phone_is_blocked(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_phone_is_blocked(text) TO service_role;
CREATE OR REPLACE FUNCTION public.record_sms_phone_choice(_phone text, _opt_in boolean, _source text, _event_at timestamptz DEFAULT now(), _event_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t text := public.phone_tail(_phone);
BEGIN
 IF length(t)<>10 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
 IF _source NOT IN ('sms_keyword','twilio_21610','twilio_export') OR (_opt_in AND _source<>'sms_keyword') THEN RAISE EXCEPTION 'Invalid consent source'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('sms-consent:'||t));
 IF _event_id IS NOT NULL AND EXISTS(SELECT 1 FROM sms_consent_log WHERE metadata->>'event_id'=_event_id AND source=_source AND public.phone_tail(phone)=t) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM sms_consent_log WHERE public.phone_tail(phone)=t AND source IN ('sms_keyword','twilio_21610','twilio_export') AND created_at>_event_at) THEN RETURN; END IF;
 PERFORM public.set_phone_sms_consent(_phone,_opt_in);
 IF NOT _opt_in THEN UPDATE profiles SET sms_opt_out_at=_event_at,sms_opt_out_source=_source WHERE public.phone_tail(phone)=t; UPDATE non_member_profiles SET sms_opt_out_at=_event_at,sms_opt_out_source=_source WHERE public.phone_tail(phone)=t; END IF;
 INSERT INTO sms_consent_log(phone,action,source,disclosure_version,created_at,metadata) VALUES(_phone,CASE WHEN _opt_in THEN 'opt_in' ELSE 'opt_out' END,_source,'v1',_event_at,jsonb_build_object('event_id',_event_id));
END $$;
REVOKE ALL ON FUNCTION public.record_sms_phone_choice(text,boolean,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_phone_choice(text,boolean,text,timestamptz,text) TO service_role;
CREATE OR REPLACE FUNCTION public.admin_sms_optout_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_any_role(auth.uid(),ARRAY['admin','super_admin','manager']::public.app_role[]) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 RETURN (WITH phones AS (SELECT DISTINCT public.phone_tail(phone) tail FROM sms_consent_log WHERE action='opt_out' AND source IN ('sms_keyword','twilio_21610','twilio_export') UNION SELECT DISTINCT public.phone_tail(phone) FROM sms_messages WHERE error_code='21610') SELECT jsonb_build_object('blocked_phones',count(*) FILTER(WHERE public.sms_phone_is_blocked(tail)), 'recorded_stop_replies',(SELECT count(*) FROM sms_consent_log WHERE action='opt_out' AND source='sms_keyword')) FROM phones WHERE length(tail)=10);
END $$;
REVOKE ALL ON FUNCTION public.admin_sms_optout_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_sms_optout_summary() TO authenticated,service_role;