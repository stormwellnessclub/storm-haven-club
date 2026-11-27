CREATE OR REPLACE FUNCTION public.admin_sms_optout_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_any_role(auth.uid(),ARRAY['admin','super_admin','manager']::public.app_role[]) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 RETURN (WITH phones AS (SELECT DISTINCT public.phone_tail(phone) tail FROM sms_consent_log WHERE action='opt_out' AND source IN ('sms_keyword','twilio_21610','twilio_export') UNION SELECT DISTINCT public.phone_tail(phone) FROM sms_messages WHERE error_code='21610') SELECT jsonb_build_object('blocked_phones',count(*) FILTER(WHERE public.sms_phone_is_blocked(tail)), 'recorded_stop_replies',(SELECT count(*) FROM sms_consent_log WHERE action='opt_out' AND source='sms_keyword'), 'carrier_filtered_30d',(SELECT count(*) FROM sms_messages WHERE error_code='30007' AND created_at > now()-interval '30 days')) FROM phones WHERE length(tail)=10);
END $$;
REVOKE ALL ON FUNCTION public.admin_sms_optout_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_sms_optout_summary() TO authenticated,service_role;