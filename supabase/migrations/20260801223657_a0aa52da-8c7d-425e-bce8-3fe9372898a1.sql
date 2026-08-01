ALTER TABLE public.spa_appointments ADD COLUMN IF NOT EXISTS tip_payment_method text;

UPDATE public.spa_appointments
SET tip_payment_method = CASE
  WHEN payment_method IN ('card','stripe') THEN 'card'
  WHEN payment_method = 'cash' THEN 'cash'
  WHEN payment_method ILIKE '%clover%' THEN 'clover'
  ELSE 'other'
END
WHERE tip_payment_method IS NULL AND COALESCE(tip_amount,0) > 0;

CREATE OR REPLACE FUNCTION public.get_therapist_payroll(_therapist_id uuid, _start_date date, _end_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _therapist record;
  _appointments jsonb;
  _result jsonb;
BEGIN
  IF NOT (public.has_any_role(ARRAY['admin','manager','therapist','front_desk']::app_role[])) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, full_name, hourly_rate INTO _therapist
  FROM public.spa_therapists WHERE id = _therapist_id;

  IF _therapist.id IS NULL THEN
    RAISE EXCEPTION 'Therapist not found';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.appointment_date, a.appointment_time), '[]'::jsonb)
  INTO _appointments
  FROM (
    SELECT
      sa.id,
      sa.appointment_date,
      sa.appointment_time,
      sa.service_name,
      sa.duration_minutes,
      sa.status,
      sa.tip_amount,
      sa.tip_payment_method,
      sa.payment_method,
      sa.amount_paid,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', m.first_name, m.last_name)), ''),
        NULLIF(TRIM(CONCAT_WS(' ', nmp.first_name, nmp.last_name)), ''),
        NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
        'Walk-in'
      ) AS customer_name
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = sa.user_id
    LEFT JOIN public.profiles p ON p.id = sa.user_id
    WHERE sa.staff_id = _therapist_id
      AND sa.appointment_date BETWEEN _start_date AND _end_date
      AND sa.status = 'completed'
  ) a;

  _result := jsonb_build_object(
    'therapist_id', _therapist.id,
    'therapist_name', _therapist.full_name,
    'hourly_rate', _therapist.hourly_rate,
    'start_date', _start_date,
    'end_date', _end_date,
    'appointments', _appointments
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_therapist_payroll(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_therapist_payroll(uuid, date, date) TO authenticated, service_role;