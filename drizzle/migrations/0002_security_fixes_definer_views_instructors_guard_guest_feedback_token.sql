-- 1) Café public views: stop relying on SECURITY DEFINER (invoker + column grants + RLS row filter)
ALTER VIEW public.cafe_reviews_public SET (security_invoker = on);
ALTER VIEW public.cafe_item_rating_summary SET (security_invoker = on);

-- Remove table-wide read on cafe_reviews (it exposes reviewer_email) and grant only safe columns
REVOKE SELECT ON public.cafe_reviews FROM authenticated;
REVOKE SELECT ON public.cafe_reviews FROM anon;

GRANT SELECT (id, menu_item_id, reviewer_display_name, rating, tags, comment, photo_path,
              is_verified_purchase, moderation_status, created_at)
  ON public.cafe_reviews TO anon;
GRANT SELECT (id, menu_item_id, order_id, reviewer_user_id, reviewer_display_name, rating, tags,
              comment, photo_path, is_verified_purchase, moderation_status, created_at)
  ON public.cafe_reviews TO authenticated;

DROP POLICY IF EXISTS "Public can read approved cafe reviews" ON public.cafe_reviews;
CREATE POLICY "Public can read approved cafe reviews"
  ON public.cafe_reviews FOR SELECT
  TO anon, authenticated
  USING (moderation_status = 'approved');

DROP POLICY IF EXISTS "Users can read own cafe reviews" ON public.cafe_reviews;
CREATE POLICY "Users can read own cafe reviews"
  ON public.cafe_reviews FOR SELECT
  TO authenticated
  USING (reviewer_user_id = auth.uid());

-- 2) Instructors: make the column-level restriction self-healing so a future table-wide
--    GRANT SELECT can never silently expose email / phone / pay rates.
CREATE OR REPLACE FUNCTION public.guard_instructor_column_grants()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_table_grant boolean;
BEGIN
  IF coalesce(current_setting('app.instructor_grant_guard', true), '') = 'running' THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c, aclexplode(c.relacl) a
    WHERE c.oid = 'public.instructors'::regclass
      AND a.privilege_type = 'SELECT'
      AND a.grantee::regrole::text IN ('anon', 'authenticated')
  ) INTO has_table_grant;

  IF NOT has_table_grant THEN
    RETURN;
  END IF;

  PERFORM set_config('app.instructor_grant_guard', 'running', true);

  REVOKE SELECT ON public.instructors FROM anon;
  REVOKE SELECT ON public.instructors FROM authenticated;

  GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, is_master,
                created_at, updated_at)
    ON public.instructors TO anon;
  GRANT SELECT (id, user_id, first_name, last_name, bio, photo_url, specialties, is_active,
                is_master, is_public_pt, portal_enabled, employment_status, schedule_color,
                can_self_book, can_edit_others_appointments, default_location_id,
                created_at, updated_at)
    ON public.instructors TO authenticated;

  PERFORM set_config('app.instructor_grant_guard', 'off', true);
  RAISE WARNING 'Table-wide SELECT on public.instructors was revoked; safe column grants restored.';
END;
$$;

DROP EVENT TRIGGER IF EXISTS guard_instructor_column_grants_trg;
CREATE EVENT TRIGGER guard_instructor_column_grants_trg
  ON ddl_command_end
  WHEN TAG IN ('GRANT')
  EXECUTE FUNCTION public.guard_instructor_column_grants();

-- Re-assert the intended state now
REVOKE SELECT ON public.instructors FROM anon;
REVOKE SELECT ON public.instructors FROM authenticated;
GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, is_master,
              created_at, updated_at)
  ON public.instructors TO anon;
GRANT SELECT (id, user_id, first_name, last_name, bio, photo_url, specialties, is_active,
              is_master, is_public_pt, portal_enabled, employment_status, schedule_color,
              can_self_book, can_edit_others_appointments, default_location_id,
              created_at, updated_at)
  ON public.instructors TO authenticated;

-- 3) Guest feedback: require a secret, server-generated per-pass token instead of a guessable id
ALTER TABLE public.guest_passes
  ADD COLUMN IF NOT EXISTS feedback_token text;

CREATE UNIQUE INDEX IF NOT EXISTS guest_passes_feedback_token_key
  ON public.guest_passes (feedback_token) WHERE feedback_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.issue_guest_feedback_token(p_guest_pass_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT feedback_token INTO v_token FROM public.guest_passes WHERE id = p_guest_pass_id;
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;
  v_token := 'gf_' || replace(gen_random_uuid()::text, '-', '')
                   || replace(gen_random_uuid()::text, '-', '');
  UPDATE public.guest_passes SET feedback_token = v_token WHERE id = p_guest_pass_id;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_guest_feedback_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_guest_feedback_token(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_guest_feedback_token(uuid) TO service_role;

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
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
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
  WHERE feedback_token = btrim(p_token);

  IF v_pass.id IS NULL OR v_pass.used_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF EXISTS (SELECT 1 FROM public.guest_feedback WHERE guest_pass_id = v_pass.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_submitted');
  END IF;

  INSERT INTO public.guest_feedback
    (feedback_token, guest_pass_id, guest_name, guest_email, rating, comment)
  VALUES
    (btrim(p_token), v_pass.id, v_pass.guest_name, v_pass.guest_email, p_rating,
     nullif(btrim(coalesce(p_comment, '')), ''));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(text, integer, text) TO anon, authenticated;

-- The old policy trusted a client-supplied token and a guessable pass id: remove it.
DROP POLICY IF EXISTS "Anyone can submit feedback for used pass" ON public.guest_feedback;
REVOKE INSERT ON public.guest_feedback FROM anon;
REVOKE SELECT ON public.guest_feedback FROM anon;
REVOKE SELECT ON public.guest_feedback FROM authenticated;
GRANT SELECT ON public.guest_feedback TO authenticated;
GRANT ALL ON public.guest_feedback TO service_role;