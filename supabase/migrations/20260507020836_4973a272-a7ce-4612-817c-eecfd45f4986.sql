CREATE OR REPLACE FUNCTION public.lookup_mothers_day_voucher(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.mothers_day_vouchers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.mothers_day_vouchers WHERE upper(code) = upper(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'id', v.id,
    'code', v.code,
    'status', v.status,
    'massage_choice', v.massage_choice,
    'massage_duration', v.massage_duration,
    'recipient_name', v.recipient_name,
    'buyer_name', v.buyer_name,
    'expires_at', v.expires_at,
    'expired', v.expires_at < now()
  );
END;
$function$;