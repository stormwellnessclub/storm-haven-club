CREATE OR REPLACE FUNCTION public.capture_google_review_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb:=to_jsonb(NEW); oldv jsonb; e text; ph text; uid uuid; nm text; typ text; at_visit timestamptz; src text; rid uuid; p public.profiles; start_at timestamptz; BEGIN
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
 IF uid IS NULL AND v->>'member_id' IS NOT NULL THEN SELECT m.user_id,coalesce(nullif(e,''),m.email),coalesce(nullif(ph,''),m.phone),coalesce(nullif(nm,''),m.first_name) INTO uid,e,ph,nm FROM public.members m WHERE m.id=(v->>'member_id')::uuid; END IF;
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