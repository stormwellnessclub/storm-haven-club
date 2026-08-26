CREATE OR REPLACE FUNCTION public.pt_set_pass_status(
  p_pass_id uuid, p_status text, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to change package status';
  END IF;
  IF p_status NOT IN ('active','exhausted','expired','refunded','cancelled') THEN
    RAISE EXCEPTION 'Unknown package status: %', p_status;
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  PERFORM set_config('pt.ledger', 'on', true);
  UPDATE public.pt_passes
     SET status = p_status::pt_pass_status, updated_at = now()
   WHERE id = p_pass_id;
  PERFORM set_config('pt.ledger', '', true);

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason,
     expires_at_before, expires_at_after, created_by)
  VALUES
    (p_pass_id, v_pass.user_id, 0, v_pass.sessions_remaining, v_pass.sessions_remaining,
     'status_change:' || v_pass.status::text || '->' || p_status, btrim(p_reason),
     v_pass.expires_at, v_pass.expires_at, auth.uid());

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_set_pass_status(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_set_pass_status(uuid,text,text) TO authenticated, service_role;