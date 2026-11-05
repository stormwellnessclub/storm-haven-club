CREATE OR REPLACE FUNCTION public.kiosk_expected_guests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'America/Detroit')::date;
BEGIN
  PERFORM public.assert_kiosk_staff();
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'guest_pass_id', g.id, 'name', g.guest_name, 'email', g.guest_email, 'phone', g.phone_number,
    'valid_date', g.valid_date, 'notes', g.visit_notes) ORDER BY g.valid_date NULLS LAST, g.guest_name)
  FROM public.guest_passes g
  WHERE g.status IN ('active','purchased') AND g.used_at IS NULL
    AND (g.valid_date = v_today OR (g.valid_date IS NULL AND g.purchased_at >= now() - interval '60 days'))), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.kiosk_expected_guests() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_expected_guests() TO authenticated;