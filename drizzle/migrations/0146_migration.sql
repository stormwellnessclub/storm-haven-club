CREATE OR REPLACE FUNCTION public.staff_record_spa_sms_consent(_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tail text := public.phone_tail(_phone);
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_tail IS NULL OR length(v_tail) <> 10 THEN RETURN false; END IF;
  INSERT INTO public.spa_guest_sms_consent(phone, opted_in, updated_at)
  VALUES ('+1'||v_tail, true, now())
  ON CONFLICT (phone) DO UPDATE SET opted_in = true, updated_at = now();
  INSERT INTO public.sms_consent_log(user_id, phone, action, source, metadata)
  VALUES (NULL, '+1'||v_tail, 'opt_in', 'staff_booking', jsonb_build_object('recorded_by', auth.uid()));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.staff_record_spa_sms_consent(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_record_spa_sms_consent(text) TO authenticated;