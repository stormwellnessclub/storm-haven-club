
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
  v_has_prior_checkin boolean := false;
  v_had_prior_activity boolean := false;
  v_first_visit_kind text := 'returning';
  v_is_first_visit boolean := false;
  v_notes text;
BEGIN
  v_today_start := date_trunc('day', now());

  SELECT id, member_id, first_name, last_name, status, membership_type, photo_url, email, user_id
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
      'first_visit_kind', 'returning',
      'member', jsonb_build_object(
        'first_name', v_member.first_name,
        'last_name', v_member.last_name,
        'membership_type', v_member.membership_type,
        'photo_url', v_member.photo_url
      ),
      'message', 'Already checked in today'
    );
  END IF;

  -- Any prior check-in as a member?
  SELECT EXISTS(
    SELECT 1 FROM public.check_ins WHERE member_id = v_member.id
  ) INTO v_has_prior_checkin;

  IF v_has_prior_checkin THEN
    v_first_visit_kind := 'returning';
  ELSE
    -- Prior activity under same email (guest, non-member profile)?
    SELECT EXISTS(
      SELECT 1 FROM public.guest_passes
        WHERE v_member.email IS NOT NULL AND guest_email ILIKE v_member.email
      UNION ALL
      SELECT 1 FROM public.non_member_profiles
        WHERE v_member.email IS NOT NULL AND email ILIKE v_member.email
    ) INTO v_had_prior_activity;

    IF v_had_prior_activity THEN
      v_first_visit_kind := 'first_as_member';
    ELSE
      v_first_visit_kind := 'first_ever';
    END IF;
  END IF;

  v_is_first_visit := v_first_visit_kind IN ('first_ever','first_as_member');

  v_notes := CASE v_first_visit_kind
    WHEN 'first_ever' THEN 'First club visit'
    WHEN 'first_as_member' THEN 'First visit as member'
    ELSE 'Kiosk check-in'
  END;

  INSERT INTO public.check_ins (member_id, checked_in_at, checked_in_by, notes)
  VALUES (v_member.id, now(), NULL, v_notes)
  RETURNING id INTO v_check_in_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', true,
    'already_in', false,
    'is_first_visit', v_is_first_visit,
    'first_visit_kind', v_first_visit_kind,
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
