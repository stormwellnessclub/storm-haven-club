CREATE OR REPLACE FUNCTION public.claim_spa_appointment_link(_appointment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid := auth.uid(); e text; p text; n int;
BEGIN
  IF u IS NULL THEN RETURN false; END IF;
  SELECT lower(trim(email)) INTO e FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL;
  SELECT public.phone_tail(phone) INTO p FROM public.profiles WHERE user_id=u;
  UPDATE public.spa_appointments a SET user_id=u
   WHERE a.id=_appointment_id AND a.user_id IS NULL
     AND ((e IS NOT NULL AND lower(trim(a.guest_email))=e)
       OR (a.guest_email IS NULL AND p IS NOT NULL AND length(p)=10 AND public.phone_tail(a.guest_phone)=p));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE ALL ON FUNCTION public.claim_spa_appointment_link(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_spa_appointment_link(uuid) TO authenticated;