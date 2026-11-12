CREATE OR REPLACE FUNCTION public.spa_sculpt_form_status(p_appointment_ids uuid[])
RETURNS TABLE (
  appointment_id uuid, intake_done boolean, consent_done boolean, provider_ack boolean, photo_consent boolean,
  review_state text, screening_level text, review_decision text, reviewed_by_name text, reviewed_at timestamptz, intake_appointment_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff boolean := public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]);
BEGIN
  RETURN QUERY
  SELECT a.id,
         i.id IS NOT NULL,
         c.id IS NOT NULL,
         CASE WHEN v_staff THEN c.provider_ack_at IS NOT NULL ELSE NULL END,
         pc.consent,
         CASE WHEN NOT v_staff THEN NULL
              WHEN i.id IS NULL THEN 'pending'
              WHEN r.id IS NOT NULL THEN 'completed'
              WHEN i.screening_level = 'clear' THEN 'clear'
              ELSE 'required' END,
         CASE WHEN v_staff THEN i.screening_level ELSE NULL END,
         CASE WHEN v_staff THEN r.decision ELSE NULL END,
         CASE WHEN v_staff THEN r.reviewer_name ELSE NULL END,
         CASE WHEN v_staff THEN r.reviewed_at ELSE NULL END,
         i.appointment_id
    FROM spa_appointments a
    JOIN spa_services s ON s.id::text = a.service_id::text AND s.service_key IS NOT NULL
    -- The forms filed for this appointment win; otherwise the client's latest ones carry over.
    LEFT JOIN LATERAL (SELECT * FROM spa_sculpt_intakes x WHERE x.user_id = a.user_id AND x.service_key = s.service_key
                        ORDER BY (x.appointment_id = a.id) DESC, x.updated_at DESC LIMIT 1) i ON true
    LEFT JOIN LATERAL (SELECT * FROM spa_sculpt_consents x WHERE x.user_id = a.user_id AND x.service_key = s.service_key
                        ORDER BY (x.appointment_id = a.id) DESC, x.signed_at DESC LIMIT 1) c ON true
    LEFT JOIN spa_photo_consents pc ON pc.user_id = a.user_id AND pc.service_key = s.service_key
    -- A review only counts if it was recorded after the intake's latest answers.
    LEFT JOIN LATERAL (SELECT * FROM spa_screening_reviews x WHERE x.intake_id = i.id AND x.reviewed_at >= i.updated_at ORDER BY x.reviewed_at DESC LIMIT 1) r ON true
   WHERE a.id = ANY (p_appointment_ids)
     AND (v_staff OR a.user_id = auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.spa_sculpt_form_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spa_sculpt_form_status(uuid[]) TO authenticated, service_role;