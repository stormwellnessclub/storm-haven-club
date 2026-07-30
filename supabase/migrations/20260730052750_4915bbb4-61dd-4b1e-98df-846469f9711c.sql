ALTER TABLE public.manual_charges ALTER COLUMN charged_by DROP NOT NULL;
ALTER TABLE public.credit_adjustments ALTER COLUMN adjusted_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.kiosk_adjust_member_credits(
  p_credit_id uuid,
  p_delta integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.member_credits%ROWTYPE;
  v_prev integer;
  v_next integer;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'No change';
  END IF;

  SELECT * INTO v_row FROM public.member_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_prev := v_row.credits_remaining;
  v_next := GREATEST(0, LEAST(v_row.credits_total, v_prev + p_delta));
  IF v_next = v_prev THEN
    RAISE EXCEPTION 'No change';
  END IF;

  UPDATE public.member_credits
     SET credits_remaining = v_next
   WHERE id = p_credit_id;

  INSERT INTO public.credit_adjustments (
    member_id, member_credit_id, credit_type, adjustment_type,
    amount, previous_balance, new_balance, reason, adjusted_by
  ) VALUES (
    v_row.member_id, v_row.id, v_row.credit_type,
    CASE WHEN p_delta > 0 THEN 'add' ELSE 'remove' END,
    ABS(v_next - v_prev), v_prev, v_next,
    COALESCE(NULLIF(p_reason, ''), 'Front desk kiosk adjustment'),
    auth.uid()
  );

  RETURN jsonb_build_object('previous', v_prev, 'new', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_adjust_member_credits(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_adjust_member_credits(uuid, integer, text) TO anon, authenticated, service_role;