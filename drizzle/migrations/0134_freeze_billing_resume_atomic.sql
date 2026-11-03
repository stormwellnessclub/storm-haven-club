ALTER TABLE public.member_freezes ADD COLUMN IF NOT EXISTS billing_resume_date date;
COMMENT ON COLUMN public.member_freezes.billing_resume_date IS 'Server-only durable billing restart intent, preserved across Stripe retries.';
CREATE OR REPLACE FUNCTION public.prepare_freeze_billing_resume(p_freeze_id uuid, p_early boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.member_freezes%ROWTYPE; m public.members%ROWTYPE; today date := (now() AT TIME ZONE 'America/Detroit')::date; restart date;
BEGIN
 SELECT * INTO f FROM public.member_freezes WHERE id=p_freeze_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Freeze not found'; END IF;
 SELECT * INTO m FROM public.members WHERE id=f.member_id FOR UPDATE;
 IF f.status='completed' THEN RETURN jsonb_build_object('completed',true); END IF;
 IF f.status<>'active' THEN RAISE EXCEPTION 'Only active freezes can end'; END IF;
 IF m.status<>'frozen' THEN RAISE EXCEPTION 'Member is not frozen; staff review required'; END IF;
 IF NOT p_early AND coalesce(f.actual_end_date,f.requested_end_date)>today THEN RAISE EXCEPTION 'Freeze has not ended'; END IF;
 IF coalesce(f.actual_start_date,f.requested_start_date)>today THEN RAISE EXCEPTION 'Freeze has not started'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_freezes WHERE member_id=m.id AND status='active' AND id<>f.id) THEN RAISE EXCEPTION 'Another active freeze exists; staff review required'; END IF;
 restart := coalesce(f.billing_resume_date,today);
 UPDATE public.member_freezes SET billing_resume_date=restart WHERE id=f.id;
 RETURN jsonb_build_object('completed',false,'member_id',m.id,'subscription_id',m.stripe_subscription_id,'resume_date',restart);
END; $$;
REVOKE ALL ON FUNCTION public.prepare_freeze_billing_resume(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_freeze_billing_resume(uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_freeze_billing_resume(p_freeze_id uuid,p_next_billing_date date) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.member_freezes%ROWTYPE; m public.members%ROWTYPE;
BEGIN
 SELECT * INTO f FROM public.member_freezes WHERE id=p_freeze_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Freeze not found'; END IF;
 SELECT * INTO m FROM public.members WHERE id=f.member_id FOR UPDATE;
 IF f.status='completed' THEN RETURN false; END IF;
 IF f.status<>'active' OR f.billing_resume_date IS NULL THEN RAISE EXCEPTION 'No active restart intent'; END IF;
 IF m.status<>'frozen' THEN RAISE EXCEPTION 'Member status changed; staff review required'; END IF;
 UPDATE public.member_freezes SET status='completed',actual_end_date=f.billing_resume_date,billing_resume_error=NULL WHERE id=f.id;
 UPDATE public.members SET status='active',next_billing_date=p_next_billing_date WHERE id=m.id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.finish_freeze_billing_resume(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_freeze_billing_resume(uuid,date) TO service_role;
CREATE OR REPLACE FUNCTION public.protect_freeze_resume_intent() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.billing_resume_date IS DISTINCT FROM OLD.billing_resume_date AND current_user NOT IN ('postgres','service_role','supabase_admin') AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Billing restart intent is server-only'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_freeze_resume_intent BEFORE UPDATE OF billing_resume_date ON public.member_freezes FOR EACH ROW EXECUTE FUNCTION public.protect_freeze_resume_intent();