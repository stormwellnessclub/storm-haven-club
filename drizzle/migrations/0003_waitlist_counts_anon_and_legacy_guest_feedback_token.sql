GRANT EXECUTE ON FUNCTION public.get_waitlist_counts(uuid[]) TO anon;

CREATE OR REPLACE FUNCTION public.submit_guest_feedback(
  p_token text,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass record;
  v_token text := btrim(coalesce(p_token, ''));
  v_legacy_id uuid;
BEGIN
  IF length(v_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;
  IF p_comment IS NOT NULL AND length(p_comment) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'comment_too_long');
  END IF;

  SELECT id, guest_name, guest_email, used_at
    INTO v_pass
  FROM public.guest_passes
  WHERE feedback_token = v_token;

  -- Legacy links emailed before secret tokens existed: fb-<guest_pass_id>.
  IF v_pass.id IS NULL AND v_token ~* '^fb-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      v_legacy_id := substring(v_token from 4)::uuid;
    EXCEPTION WHEN others THEN
      v_legacy_id := NULL;
    END;

    IF v_legacy_id IS NOT NULL THEN
      SELECT id, guest_name, guest_email, used_at
        INTO v_pass
      FROM public.guest_passes
      WHERE id = v_legacy_id
        AND feedback_token IS NULL
        AND feedback_email_sent_at IS NOT NULL;
    END IF;
  END IF;

  IF v_pass.id IS NULL OR v_pass.used_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF EXISTS (SELECT 1 FROM public.guest_feedback WHERE guest_pass_id = v_pass.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;

  INSERT INTO public.guest_feedback
    (feedback_token, guest_pass_id, guest_name, guest_email, rating, comment)
  VALUES
    (v_token, v_pass.id, v_pass.guest_name, v_pass.guest_email, p_rating,
     nullif(btrim(coalesce(p_comment, '')), ''));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_guest_feedback(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(text, integer, text) TO anon, authenticated;