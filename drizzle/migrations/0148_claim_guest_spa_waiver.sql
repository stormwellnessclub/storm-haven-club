CREATE OR REPLACE FUNCTION public.claim_verified_spa_guest_bookings()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e text; u uuid:=auth.uid(); w timestamptz;
BEGIN
 SELECT lower(trim(email)) INTO e FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL;
 IF e IS NULL THEN RETURN; END IF;
 UPDATE public.spa_appointments SET user_id=u WHERE user_id IS NULL AND lower(trim(guest_email))=e;
 UPDATE public.spa_body_wrap_intakes i SET user_id=u FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=e;
 UPDATE public.spa_intake_forms i SET user_id=u FROM public.spa_guest_checkouts c WHERE c.appointment_id=i.appointment_id AND i.user_id=c.id AND lower(c.guest_email)=e;
 SELECT max(waiver_signed_at) INTO w FROM public.spa_guest_checkouts WHERE lower(trim(guest_email))=e AND waiver_signed_at IS NOT NULL;
 IF w IS NOT NULL THEN
   UPDATE public.profiles SET waiver_signed=true, waiver_signed_at=w WHERE user_id=u AND waiver_signed IS NOT TRUE;
   UPDATE public.non_member_profiles SET waiver_signed=true, waiver_signed_at=w WHERE user_id=u AND waiver_signed IS NOT TRUE;
 END IF;
END $function$;