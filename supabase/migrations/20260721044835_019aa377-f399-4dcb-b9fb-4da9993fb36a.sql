
CREATE OR REPLACE FUNCTION public.kiosk_check_in_member(p_member_id_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_check_in_id uuid;
  v_today_start timestamptz;
  v_already_checked_in boolean := false;
  v_eligibility jsonb;
  v_access_granted boolean;
  v_denial_reason text;
  v_is_first_visit boolean := false;
BEGIN
  v_today_start := date_trunc('day', now());

  SELECT id, member_id, first_name, last_name, status, membership_type, photo_url, email
  INTO v_member
  FROM public.members
  WHERE member_id ILIKE p_member_id_text
     OR email ILIKE p_member_id_text
     OR (first_name || ' ' || last_name) ILIKE '%' || p_member_id_text || '%'
  LIMIT 1;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'access_granted', false,
      'error', 'member_not_found',
      'message', 'No member found with that ID'
    );
  END IF;

  v_eligibility := public.evaluate_member_check_in_eligibility(v_member.id);
  v_access_granted := (v_eligibility->>'access_granted')::boolean;
  v_denial_reason := v_eligibility->>'denial_reason';

  IF NOT v_access_granted THEN
    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', v_denial_reason,
      'member', jsonb_build_object(
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'membership_type', v_member.membership_type,
        'photo_url', v_member.photo_url,
        'status', v_member.status
      )
    );
  END IF;

  -- Already checked in today?
  SELECT EXISTS(
    SELECT 1 FROM public.check_ins
    WHERE member_id = v_member.id
      AND checked_in_at >= v_today_start
      AND checked_out_at IS NULL
  ) INTO v_already_checked_in;

  IF v_already_checked_in THEN
    RETURN jsonb_build_object(
      'success', true, 'access_granted', true, 'already_in', true,
      'is_first_visit', false,
      'member', jsonb_build_object(
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'membership_type', v_member.membership_type,
        'photo_url', v_member.photo_url
      ),
      'message', 'Already checked in today'
    );
  END IF;

  -- First-ever club visit?
  SELECT NOT EXISTS(
    SELECT 1 FROM public.check_ins WHERE member_id = v_member.id
  ) INTO v_is_first_visit;

  INSERT INTO public.check_ins (member_id, checked_in_at, checked_in_by, notes)
  VALUES (
    v_member.id,
    now(),
    NULL,
    CASE WHEN v_is_first_visit THEN 'First club visit' ELSE 'Kiosk check-in' END
  )
  RETURNING id INTO v_check_in_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', true,
    'already_in', false,
    'is_first_visit', v_is_first_visit,
    'check_in_id', v_check_in_id,
    'member', jsonb_build_object(
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'membership_type', v_member.membership_type,
      'photo_url', v_member.photo_url,
      'status', v_member.status
    )
  );
END;
$function$;

-- Helper: staff can append "Tour offered" note to a first-visit check-in
CREATE OR REPLACE FUNCTION public.mark_first_visit_tour_offered(
  p_check_in_id uuid,
  p_staff_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_note text;
BEGIN
  v_note := 'First club visit · Tour offered'
    || CASE WHEN p_staff_name IS NOT NULL AND length(trim(p_staff_name)) > 0
            THEN ' by ' || trim(p_staff_name) ELSE '' END;

  UPDATE public.check_ins
  SET notes = v_note
  WHERE id = p_check_in_id
    AND notes ILIKE 'First club visit%';

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_first_visit_tour_offered(uuid, text) TO authenticated;
