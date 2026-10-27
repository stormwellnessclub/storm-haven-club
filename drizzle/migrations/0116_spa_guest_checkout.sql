CREATE TABLE public.spa_guest_checkouts (
 id uuid PRIMARY KEY, user_id uuid, access_hash text NOT NULL, service_id uuid NOT NULL, availability_id uuid NOT NULL,
 appointment_date date NOT NULL, appointment_time time NOT NULL, duration_minutes integer NOT NULL, cleanup_minutes integer NOT NULL,
 staff_id uuid, room_id uuid, guest_name text NOT NULL, guest_email text NOT NULL, guest_phone text NOT NULL,
 sms_opt_in boolean NOT NULL DEFAULT false, notes text, service_price numeric NOT NULL, member_price numeric,
 amount_cents integer NOT NULL, payment_intent_id text UNIQUE, appointment_id uuid UNIQUE REFERENCES public.spa_appointments(id),
 status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL DEFAULT now()+interval '20 minutes',
 access_expires_at timestamptz NOT NULL DEFAULT now()+interval '120 days', notified_at timestamptz,
 waiver_name text, waiver_agreement_id uuid, waiver_signed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.spa_guest_checkouts TO service_role;
ALTER TABLE public.spa_guest_checkouts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.spa_guest_sms_consent (phone text PRIMARY KEY, opted_in boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.spa_guest_sms_consent TO service_role;
ALTER TABLE public.spa_guest_sms_consent ENABLE ROW LEVEL SECURITY;
CREATE INDEX spa_guest_checkout_slot ON public.spa_guest_checkouts(appointment_date,staff_id,room_id);
CREATE OR REPLACE FUNCTION public.reserve_spa_guest_checkout(p_id uuid,p_intent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.spa_guest_checkouts; s public.spa_services; a public.spa_service_availability; result uuid;
BEGIN
 SELECT * INTO c FROM public.spa_guest_checkouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.payment_intent_id IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'Invalid checkout'; END IF;
 IF c.appointment_id IS NOT NULL THEN RETURN c.appointment_id; END IF;
 IF c.expires_at<now() OR c.status<>'pending' THEN RAISE EXCEPTION 'Checkout expired; please choose your time again'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('spa:'||c.appointment_date::text,0));
 SELECT * INTO s FROM public.spa_services WHERE id=c.service_id AND is_active;
 SELECT * INTO a FROM public.spa_service_availability WHERE id=c.availability_id AND is_active;
 IF s.id IS NULL OR a.id IS NULL OR a.service_id<>s.id OR (a.starts_on IS NOT NULL AND c.appointment_date<a.starts_on)
 OR (a.specific_date IS NOT NULL AND a.specific_date<>c.appointment_date)
 OR (a.specific_date IS NULL AND a.day_of_week<>extract(dow FROM c.appointment_date))
 OR c.appointment_time<a.start_time OR c.appointment_time+make_interval(mins=>c.duration_minutes+c.cleanup_minutes)>a.end_time
 OR c.appointment_date<(now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'That time is no longer available'; END IF;
 IF EXISTS(SELECT 1 FROM public.spa_appointments b WHERE b.appointment_date=c.appointment_date AND b.status NOT IN ('cancelled','no_show')
 AND ((c.staff_id IS NOT NULL AND b.staff_id=c.staff_id) OR (c.room_id IS NOT NULL AND b.room_id=c.room_id))
 AND b.appointment_time<c.appointment_time+make_interval(mins=>c.duration_minutes+c.cleanup_minutes)
 AND c.appointment_time<b.appointment_time+make_interval(mins=>b.duration_minutes+b.cleanup_minutes)) THEN RAISE EXCEPTION 'That time is already booked'; END IF;
 INSERT INTO public.spa_appointments(user_id,member_id,service_id,service_name,service_category,service_price,member_price,appointment_date,appointment_time,duration_minutes,cleanup_minutes,status,staff_id,room_id,guest_name,guest_email,guest_phone,member_notes,payment_method,payment_intent_id,amount_paid,created_via)
 VALUES(c.user_id,(SELECT id FROM public.members WHERE user_id=c.user_id AND status<>'cancelled' LIMIT 1),s.id::text,s.name,s.category,c.service_price,c.member_price,c.appointment_date,c.appointment_time,c.duration_minutes,c.cleanup_minutes,'confirmed',c.staff_id,c.room_id,c.guest_name,c.guest_email,c.guest_phone,c.notes,'card',p_intent,0,'non_member_portal') RETURNING id INTO result;
 UPDATE public.spa_guest_checkouts SET appointment_id=result,status='reserved' WHERE id=c.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_spa_guest_checkout(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_spa_guest_checkout(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.link_spa_guest_appointments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE verified_email text;
BEGIN
 SELECT lower(trim(email)) INTO verified_email FROM auth.users WHERE id=NEW.user_id AND email_confirmed_at IS NOT NULL;
 IF verified_email IS NOT NULL THEN
 UPDATE public.spa_appointments SET user_id=NEW.user_id WHERE user_id IS NULL AND lower(trim(guest_email))=verified_email;
 UPDATE public.spa_body_wrap_intakes i SET user_id=NEW.user_id FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=verified_email;
 UPDATE public.spa_intake_forms i SET user_id=NEW.user_id FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=verified_email;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.claim_verified_spa_guest_bookings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e text; u uuid:=auth.uid();
BEGIN
 SELECT lower(trim(email)) INTO e FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL;
 IF e IS NULL THEN RETURN; END IF;
 UPDATE public.spa_appointments SET user_id=u WHERE user_id IS NULL AND lower(trim(guest_email))=e;
 UPDATE public.spa_body_wrap_intakes i SET user_id=u FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=e;
 UPDATE public.spa_intake_forms i SET user_id=u FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=e;
END $$;
REVOKE ALL ON FUNCTION public.claim_verified_spa_guest_bookings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_spa_guest_bookings() TO authenticated;
CREATE OR REPLACE FUNCTION public.phone_sms_consent(_phone text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH t AS (SELECT public.phone_tail(_phone) tail)
 SELECT length((SELECT tail FROM t))=10 AND (
 EXISTS(SELECT 1 FROM marketing_contacts c,t WHERE public.phone_tail(c.phone)=t.tail AND c.opted_in_sms AND c.unsubscribed_at IS NULL)
 OR EXISTS(SELECT 1 FROM non_member_profiles n,t WHERE public.phone_tail(n.phone)=t.tail AND n.sms_opt_in AND n.sms_opt_out_at IS NULL)
 OR EXISTS(SELECT 1 FROM spa_guest_sms_consent g,t WHERE public.phone_tail(g.phone)=t.tail AND g.opted_in))
$$;
CREATE OR REPLACE FUNCTION public.update_spa_guest_sms_keyword() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.source='sms_keyword' AND NEW.action IN ('opt_in','opt_out') THEN
 UPDATE public.spa_guest_sms_consent SET opted_in=(NEW.action='opt_in'),updated_at=now() WHERE public.phone_tail(phone)=public.phone_tail(NEW.phone);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER spa_guest_sms_keyword AFTER INSERT ON public.sms_consent_log FOR EACH ROW EXECUTE FUNCTION public.update_spa_guest_sms_keyword();