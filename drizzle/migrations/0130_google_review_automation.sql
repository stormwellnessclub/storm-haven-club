CREATE TABLE public.google_review_settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), enabled boolean NOT NULL DEFAULT true, activated_at timestamptz NOT NULL DEFAULT now(), last_attempt_at timestamptz);
GRANT SELECT,UPDATE ON public.google_review_settings TO authenticated;
GRANT ALL ON public.google_review_settings TO service_role;
ALTER TABLE public.google_review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_settings_staff ON public.google_review_settings FOR ALL TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[]));
INSERT INTO public.google_review_settings(id) SELECT true;
CREATE TABLE public.google_review_people (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, phone text, user_id uuid, name text, reviewed_at timestamptz, marked_by uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.google_review_people TO authenticated;
GRANT ALL ON public.google_review_people TO service_role;
ALTER TABLE public.google_review_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_people_staff ON public.google_review_people FOR ALL TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[]));
CREATE TABLE public.google_review_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK (source IN ('class','spa','guest')), visit_id uuid NOT NULL, visit_at timestamptz NOT NULL, visit_type text NOT NULL, email text, phone text, user_id uuid, first_name text, reserved_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,visit_id));
GRANT SELECT ON public.google_review_requests TO authenticated;
GRANT ALL ON public.google_review_requests TO service_role;
ALTER TABLE public.google_review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_requests_staff ON public.google_review_requests FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[]));
CREATE TABLE public.google_review_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.google_review_requests(id), channel text NOT NULL CHECK(channel IN ('sms','email')), due_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','attempted','sent','skipped','failed')), attempted_at timestamptz, sent_at timestamptz, detail text, UNIQUE(request_id,channel));
GRANT SELECT ON public.google_review_messages TO authenticated;
GRANT ALL ON public.google_review_messages TO service_role;
ALTER TABLE public.google_review_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_messages_staff ON public.google_review_messages FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager']::public.app_role[]));
CREATE INDEX review_due ON public.google_review_messages(due_at) WHERE status='pending';
ALTER TABLE public.guest_passes ADD COLUMN visit_completed_at timestamptz;
CREATE FUNCTION public.complete_guest_visit(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager','front_desk']::public.app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 UPDATE public.guest_passes SET visit_completed_at=now() WHERE id=_id AND used_at IS NOT NULL AND status IN ('used','exhausted') AND NOT coalesce(no_show,false) AND visit_completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Visit must be checked in and not already completed or a no-show'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.complete_guest_visit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_guest_visit(uuid) TO authenticated;
CREATE FUNCTION public.google_review_slot(_at timestamptz) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE t timestamp:=_at AT TIME ZONE 'America/Detroit'; d date:=t::date; i int; s timestamp; BEGIN
 FOR i IN 0..14 LOOP s:=d+time '09:00'+i*interval '48 minutes'; IF s>=t THEN RETURN s AT TIME ZONE 'America/Detroit'; END IF; END LOOP;
 RETURN (d+1+time '09:00') AT TIME ZONE 'America/Detroit'; END $$;
CREATE FUNCTION public.arm_google_review_timer() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t timestamptz; u timestamp; last_at timestamptz; BEGIN
 PERFORM pg_advisory_xact_lock(7402901);
 PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='google-review-next';
 IF NOT EXISTS(SELECT 1 FROM public.google_review_settings WHERE enabled) THEN RETURN; END IF;
 SELECT min(due_at) INTO t FROM public.google_review_messages WHERE status='pending'; IF t IS NULL THEN RETURN; END IF;
 SELECT last_attempt_at INTO last_at FROM public.google_review_settings;
 t:=public.google_review_slot(greatest(t,now()+interval '1 minute',coalesce(last_at+interval '48 minutes',now())));
 WHILE (SELECT count(*) FROM public.google_review_messages WHERE (attempted_at AT TIME ZONE 'America/Detroit')::date=(t AT TIME ZONE 'America/Detroit')::date)>=15 LOOP t:=public.google_review_slot(((t AT TIME ZONE 'America/Detroit')::date+1+time '09:00') AT TIME ZONE 'America/Detroit'); END LOOP;
 u:=t AT TIME ZONE 'UTC';
 PERFORM cron.schedule('google-review-next',format('%s %s %s %s *',extract(minute from u)::int,extract(hour from u)::int,extract(day from u)::int,extract(month from u)::int),$job$select cron.unschedule('google-review-next'); select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/campaign-studio',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public.internal_task_token()),body:='{"action":"review_tick"}'::jsonb,timeout_milliseconds:=60000);$job$);
END $$;
CREATE FUNCTION public.capture_google_review_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb:=to_jsonb(NEW); oldv jsonb; e text; ph text; uid uuid; nm text; typ text; at_visit timestamptz; src text; rid uuid; p public.profiles; start_at timestamptz; BEGIN
 IF TG_OP='UPDATE' THEN oldv:=to_jsonb(OLD); ELSE oldv:='{}'::jsonb; END IF;
 SELECT activated_at INTO start_at FROM public.google_review_settings WHERE enabled; IF start_at IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='class_bookings' THEN
  IF v->>'status'<>'completed' OR oldv->>'status'='completed' OR (v->>'is_admin_hold')::boolean IS TRUE THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.members m WHERE m.status<>'cancelled' AND (m.id=NEW.member_id OR m.user_id=NEW.user_id OR lower(m.email)=lower(NEW.walk_in_email))) THEN RETURN NEW; END IF;
  SELECT (s.session_date+s.end_time) AT TIME ZONE 'America/Detroit',coalesce(c.name,'class')||' class' INTO at_visit,typ FROM public.class_sessions s LEFT JOIN public.class_types c ON c.id=s.class_type_id WHERE s.id=NEW.session_id AND NOT s.is_cancelled;
  e:=NEW.walk_in_email; ph:=NEW.walk_in_phone; nm:=NEW.walk_in_name; uid:=NEW.user_id; src:='class';
 ELSIF TG_TABLE_NAME='spa_appointments' THEN
  IF v->>'status'<>'completed' OR oldv->>'status'='completed' THEN RETURN NEW; END IF;
  at_visit:=greatest(NEW.completed_at,((NEW.appointment_date+NEW.appointment_time) AT TIME ZONE 'America/Detroit')+make_interval(mins=>NEW.duration_minutes)); typ:='spa appointment'; e:=NEW.guest_email; ph:=NEW.guest_phone; nm:=NEW.guest_name; uid:=NEW.user_id; src:='spa';
 ELSE
  IF NEW.visit_completed_at IS NULL OR oldv->>'visit_completed_at' IS NOT NULL OR NEW.used_at IS NULL OR coalesce(NEW.no_show,false) OR NEW.status NOT IN ('used','exhausted') THEN RETURN NEW; END IF;
  at_visit:=NEW.visit_completed_at; typ:='guest pass visit'; e:=NEW.guest_email; ph:=NEW.phone_number; nm:=NEW.guest_name; uid:=NEW.user_id; src:='guest';
 END IF;
 IF at_visit IS NULL OR at_visit<start_at THEN RETURN NEW; END IF;
 IF uid IS NOT NULL THEN SELECT * INTO p FROM public.profiles WHERE user_id=uid LIMIT 1; e:=coalesce(nullif(e,''),p.email); ph:=coalesce(nullif(ph,''),p.phone); nm:=coalesce(nullif(nm,''),p.first_name); END IF;
 e:=nullif(lower(trim(e)),''); ph:=nullif(right(regexp_replace(ph,'\D','','g'),10),'');
 IF e IS NULL AND ph IS NULL AND uid IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(7402901);
 IF EXISTS(SELECT 1 FROM public.google_review_people x WHERE x.reviewed_at IS NOT NULL AND ((e IS NOT NULL AND x.email=e) OR (ph IS NOT NULL AND x.phone=ph) OR (uid IS NOT NULL AND x.user_id=uid))) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.google_review_requests x WHERE greatest(x.reserved_at,coalesce((SELECT max(m.attempted_at) FROM public.google_review_messages m WHERE m.request_id=x.id),x.reserved_at))>now()-interval '90 days' AND ((e IS NOT NULL AND x.email=e) OR (ph IS NOT NULL AND x.phone=ph) OR (uid IS NOT NULL AND x.user_id=uid))) THEN RETURN NEW; END IF;
 INSERT INTO public.google_review_requests(source,visit_id,visit_at,visit_type,email,phone,user_id,first_name) VALUES(src,NEW.id,at_visit,typ,e,ph,uid,split_part(nm,' ',1)) ON CONFLICT DO NOTHING RETURNING id INTO rid;
 IF rid IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.google_review_messages(request_id,channel,due_at) VALUES(rid,'sms',at_visit+interval '24 hours'),(rid,'email',at_visit+interval '48 hours');
 PERFORM public.arm_google_review_timer(); RETURN NEW;
END $$;
CREATE TRIGGER google_review_class AFTER INSERT OR UPDATE OF status ON public.class_bookings FOR EACH ROW EXECUTE FUNCTION public.capture_google_review_visit();
CREATE TRIGGER google_review_spa AFTER INSERT OR UPDATE OF status ON public.spa_appointments FOR EACH ROW EXECUTE FUNCTION public.capture_google_review_visit();
CREATE TRIGGER google_review_guest AFTER UPDATE OF visit_completed_at ON public.guest_passes FOR EACH ROW EXECUTE FUNCTION public.capture_google_review_visit();
CREATE FUNCTION public.claim_google_review_message() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE m public.google_review_messages; r public.google_review_requests; cfg public.google_review_settings; valid boolean; BEGIN
 PERFORM pg_advisory_xact_lock(7402901); SELECT * INTO cfg FROM public.google_review_settings;
 IF NOT cfg.enabled THEN RETURN NULL; END IF;
 IF cfg.last_attempt_at>now()-interval '48 minutes' OR (SELECT count(*) FROM public.google_review_messages WHERE (attempted_at AT TIME ZONE 'America/Detroit')::date=(now() AT TIME ZONE 'America/Detroit')::date)>=15 OR (now() AT TIME ZONE 'America/Detroit')::time<time '09:00' OR (now() AT TIME ZONE 'America/Detroit')::time>time '20:15' THEN PERFORM public.arm_google_review_timer(); RETURN NULL; END IF;
 SELECT * INTO m FROM public.google_review_messages WHERE status='pending' AND due_at<=now() ORDER BY due_at,id LIMIT 1 FOR UPDATE;
 IF m.id IS NULL THEN PERFORM public.arm_google_review_timer(); RETURN NULL; END IF;
 SELECT * INTO r FROM public.google_review_requests WHERE id=m.request_id;
 IF r.source='spa' THEN SELECT status='completed' INTO valid FROM public.spa_appointments WHERE id=r.visit_id;
 ELSIF r.source='class' THEN SELECT b.status='completed' AND NOT s.is_cancelled INTO valid FROM public.class_bookings b JOIN public.class_sessions s ON s.id=b.session_id WHERE b.id=r.visit_id;
 ELSE SELECT visit_completed_at IS NOT NULL AND NOT coalesce(no_show,false) AND status IN ('used','exhausted') INTO valid FROM public.guest_passes WHERE id=r.visit_id; END IF;
 IF NOT coalesce(valid,false) OR EXISTS(SELECT 1 FROM public.google_review_people x WHERE reviewed_at IS NOT NULL AND ((r.email IS NOT NULL AND x.email=r.email) OR (r.phone IS NOT NULL AND x.phone=r.phone) OR (r.user_id IS NOT NULL AND x.user_id=r.user_id))) THEN
 UPDATE public.google_review_messages SET status='skipped',detail='Review confirmed or visit no longer completed' WHERE request_id=r.id AND status='pending';
 PERFORM public.arm_google_review_timer(); RETURN NULL; END IF;
 UPDATE public.google_review_messages SET status='attempted',attempted_at=now() WHERE id=m.id;
 UPDATE public.google_review_settings SET last_attempt_at=now();
 PERFORM public.arm_google_review_timer();
 RETURN to_jsonb(r)||jsonb_build_object('message_id',m.id,'channel',m.channel);
END $$;
CREATE FUNCTION public.google_review_settings_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.arm_google_review_timer(); RETURN NEW; END $$;
CREATE TRIGGER review_settings_wake AFTER UPDATE OF enabled ON public.google_review_settings FOR EACH ROW EXECUTE FUNCTION public.google_review_settings_wake();
REVOKE ALL ON FUNCTION public.arm_google_review_timer(),public.claim_google_review_message(),public.capture_google_review_visit(),public.google_review_settings_wake() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arm_google_review_timer(),public.claim_google_review_message() TO service_role;