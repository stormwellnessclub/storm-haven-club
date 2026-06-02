
-- Allow open/public spa reviews (no appointment), email capture, expand source check
ALTER TABLE public.spa_reviews ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE public.spa_reviews ADD COLUMN IF NOT EXISTS reviewer_email text;

ALTER TABLE public.spa_reviews DROP CONSTRAINT IF EXISTS spa_reviews_source_check;
ALTER TABLE public.spa_reviews ADD CONSTRAINT spa_reviews_source_check
  CHECK (source = ANY (ARRAY['portal'::text, 'token'::text, 'public'::text]));

-- Public submission RPC. Inserts as hidden so an admin must approve before display.
CREATE OR REPLACE FUNCTION public.submit_public_spa_review(
  _service_id uuid,
  _therapist_id uuid,
  _rating integer,
  _review_text text,
  _display_name text,
  _email text,
  _honeypot text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(coalesce(_display_name, '')), '');
  v_email text := lower(NULLIF(btrim(coalesce(_email, '')), ''));
  v_text text := NULLIF(btrim(coalesce(_review_text, '')), '');
  v_id uuid;
BEGIN
  IF _honeypot IS NOT NULL AND length(btrim(_honeypot)) > 0 THEN
    RETURN jsonb_build_object('success', true, 'id', NULL);
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;

  IF _service_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_service');
  END IF;

  IF v_name IS NULL OR length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_name');
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  IF v_text IS NOT NULL AND length(v_text) > 1000 THEN
    v_text := substring(v_text from 1 for 1000);
  END IF;

  INSERT INTO public.spa_reviews (
    user_id, appointment_id, service_id, therapist_id,
    rating, review_text, is_visible, source,
    reviewer_display_name, reviewer_email
  ) VALUES (
    auth.uid(), NULL, _service_id, _therapist_id,
    _rating, v_text, false, 'public',
    substring(v_name from 1 for 80), v_email
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_spa_review(uuid, uuid, integer, text, text, text, text) TO anon, authenticated;
