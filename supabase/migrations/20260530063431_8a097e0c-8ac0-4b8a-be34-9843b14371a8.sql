
-- Make spa_reviews.user_id nullable so anonymous (tokenized) reviews can be saved
ALTER TABLE public.spa_reviews ALTER COLUMN user_id DROP NOT NULL;

-- Tag the source of each review (defaults preserve existing rows as 'portal')
ALTER TABLE public.spa_reviews ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal';
ALTER TABLE public.spa_reviews ADD CONSTRAINT spa_reviews_source_check CHECK (source IN ('portal','token'));

-- Capture display name for tokenized submissions when no user record exists
ALTER TABLE public.spa_reviews ADD COLUMN IF NOT EXISTS reviewer_display_name TEXT;

-- Allow staff insert for tokenized reviews via RPC (RPC is SECURITY DEFINER so this is belt+suspenders)
DROP POLICY IF EXISTS "Users can review their own completed appointments" ON public.spa_reviews;
CREATE POLICY "Users can review their own completed appointments"
  ON public.spa_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.spa_appointments sa
      WHERE sa.id = appointment_id
        AND sa.user_id = auth.uid()
        AND sa.status = 'completed'
    )
  );

-- =========================
-- spa_review_tokens
-- =========================
CREATE TABLE public.spa_review_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  user_id UUID,
  service_id_text TEXT,
  service_id_uuid UUID,
  therapist_id UUID,
  recipient_email TEXT,
  recipient_name TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  service_name TEXT,
  email_sent_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.spa_review_tokens TO service_role;
-- No anon/authenticated grants — all access via SECURITY DEFINER RPCs

ALTER TABLE public.spa_review_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view spa review tokens"
  ON public.spa_review_tokens FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE INDEX idx_spa_review_tokens_email_sent ON public.spa_review_tokens(email_sent_at) WHERE email_sent_at IS NULL;

-- =========================
-- Ensure (idempotent) a token row exists for an appointment
-- =========================
CREATE OR REPLACE FUNCTION public.ensure_spa_review_token(_appointment_id UUID)
  RETURNS UUID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_token UUID;
  v_sa RECORD;
  v_email TEXT;
  v_name TEXT;
BEGIN
  -- Auth: must be staff or the appointment owner
  IF NOT (
    public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','staff']::app_role[])
    OR EXISTS (SELECT 1 FROM public.spa_appointments WHERE id = _appointment_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT token INTO v_token FROM public.spa_review_tokens WHERE appointment_id = _appointment_id;
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  SELECT sa.* INTO v_sa FROM public.spa_appointments sa WHERE sa.id = _appointment_id;
  IF v_sa IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Resolve recipient email + display name from members / profiles / non_member_profiles
  SELECT COALESCE(m.email, p.email, nm.email),
         TRIM(COALESCE(m.first_name, p.first_name, nm.first_name, '') || ' ' ||
              COALESCE(m.last_name,  p.last_name,  nm.last_name,  ''))
    INTO v_email, v_name
  FROM (SELECT v_sa.user_id AS uid) u
  LEFT JOIN public.members m ON m.user_id = u.uid
  LEFT JOIN public.profiles p ON p.id = u.uid
  LEFT JOIN public.non_member_profiles nm ON nm.user_id = u.uid;

  INSERT INTO public.spa_review_tokens (
    appointment_id, user_id, service_id_text, service_id_uuid, therapist_id,
    recipient_email, recipient_name,
    appointment_date, appointment_time, service_name
  ) VALUES (
    v_sa.id, v_sa.user_id, v_sa.service_id,
    CASE WHEN v_sa.service_id ~ '^[0-9a-f-]{36}$' THEN v_sa.service_id::uuid ELSE NULL END,
    v_sa.staff_id, v_email, NULLIF(v_name, ''),
    v_sa.appointment_date, v_sa.appointment_time, v_sa.service_name
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_spa_review_token(UUID) TO authenticated;

-- =========================
-- Trigger: on appointment completion, create a token row
-- =========================
CREATE OR REPLACE FUNCTION public.create_spa_review_token_on_complete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COALESCE(m.email, p.email, nm.email),
           TRIM(COALESCE(m.first_name, p.first_name, nm.first_name, '') || ' ' ||
                COALESCE(m.last_name,  p.last_name,  nm.last_name,  ''))
      INTO v_email, v_name
    FROM (SELECT NEW.user_id AS uid) u
    LEFT JOIN public.members m ON m.user_id = u.uid
    LEFT JOIN public.profiles p ON p.id = u.uid
    LEFT JOIN public.non_member_profiles nm ON nm.user_id = u.uid;

    INSERT INTO public.spa_review_tokens (
      appointment_id, user_id, service_id_text, service_id_uuid, therapist_id,
      recipient_email, recipient_name,
      appointment_date, appointment_time, service_name
    ) VALUES (
      NEW.id, NEW.user_id, NEW.service_id,
      CASE WHEN NEW.service_id ~ '^[0-9a-f-]{36}$' THEN NEW.service_id::uuid ELSE NULL END,
      NEW.staff_id, v_email, NULLIF(v_name, ''),
      NEW.appointment_date, NEW.appointment_time, NEW.service_name
    )
    ON CONFLICT (appointment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_spa_review_token_on_complete
  AFTER UPDATE OF status ON public.spa_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_spa_review_token_on_complete();

-- Backfill tokens for already-completed appointments
INSERT INTO public.spa_review_tokens (
  appointment_id, user_id, service_id_text, service_id_uuid, therapist_id,
  recipient_email, recipient_name,
  appointment_date, appointment_time, service_name,
  email_sent_at -- mark as already-sent so we don't spam history
)
SELECT sa.id, sa.user_id, sa.service_id,
       CASE WHEN sa.service_id ~ '^[0-9a-f-]{36}$' THEN sa.service_id::uuid ELSE NULL END,
       sa.staff_id,
       COALESCE(m.email, p.email, nm.email),
       NULLIF(TRIM(COALESCE(m.first_name, p.first_name, nm.first_name, '') || ' ' ||
                   COALESCE(m.last_name,  p.last_name,  nm.last_name,  '')), ''),
       sa.appointment_date, sa.appointment_time, sa.service_name,
       now()
FROM public.spa_appointments sa
LEFT JOIN public.members m ON m.user_id = sa.user_id
LEFT JOIN public.profiles p ON p.id = sa.user_id
LEFT JOIN public.non_member_profiles nm ON nm.user_id = sa.user_id
WHERE sa.status = 'completed'
ON CONFLICT (appointment_id) DO NOTHING;

-- =========================
-- Public RPC: fetch token info (anon-callable)
-- =========================
CREATE OR REPLACE FUNCTION public.get_spa_review_token_info(_token UUID)
  RETURNS TABLE(
    valid BOOLEAN,
    already_used BOOLEAN,
    expired BOOLEAN,
    service_name TEXT,
    therapist_name TEXT,
    appointment_date DATE,
    appointment_time TIME,
    reviewer_name TEXT
  )
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT srt.*, st.full_name AS t_name
    INTO v_row
  FROM public.spa_review_tokens srt
  LEFT JOIN public.spa_therapists st ON st.id = srt.therapist_id
  WHERE srt.token = _token;

  IF v_row IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, FALSE, NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TIME, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    TRUE,
    v_row.used_at IS NOT NULL,
    v_row.expires_at < now(),
    v_row.service_name,
    v_row.t_name,
    v_row.appointment_date,
    v_row.appointment_time,
    v_row.recipient_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spa_review_token_info(UUID) TO anon, authenticated;

-- =========================
-- Public RPC: submit review with token (anon-callable)
-- =========================
CREATE OR REPLACE FUNCTION public.submit_spa_review_via_token(
  _token UUID,
  _rating INTEGER,
  _review_text TEXT DEFAULT NULL,
  _display_name TEXT DEFAULT NULL
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_review_id UUID;
  v_name TEXT;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rating');
  END IF;

  SELECT * INTO v_row FROM public.spa_review_tokens WHERE token = _token FOR UPDATE;
  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;
  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;
  IF v_row.service_id_uuid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_unmapped');
  END IF;

  v_name := NULLIF(TRIM(COALESCE(_display_name, '')), '');
  IF v_name IS NULL THEN v_name := v_row.recipient_name; END IF;

  INSERT INTO public.spa_reviews (
    user_id, appointment_id, service_id, therapist_id,
    rating, review_text, source, reviewer_display_name
  ) VALUES (
    v_row.user_id, v_row.appointment_id, v_row.service_id_uuid, v_row.therapist_id,
    _rating, NULLIF(TRIM(COALESCE(_review_text, '')), ''), 'token', v_name
  )
  ON CONFLICT (appointment_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        reviewer_display_name = COALESCE(EXCLUDED.reviewer_display_name, public.spa_reviews.reviewer_display_name),
        updated_at = now()
  RETURNING id INTO v_review_id;

  UPDATE public.spa_review_tokens SET used_at = now() WHERE token = _token;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_spa_review_via_token(UUID, INTEGER, TEXT, TEXT) TO anon, authenticated;

-- =========================
-- Update name resolver to prefer reviewer_display_name for tokenized/anon reviews
-- =========================
CREATE OR REPLACE FUNCTION public.get_spa_reviews_with_names(_service_id UUID DEFAULT NULL)
  RETURNS TABLE(
    id UUID,
    rating INTEGER,
    review_text TEXT,
    is_visible BOOLEAN,
    created_at TIMESTAMPTZ,
    service_id UUID,
    service_name TEXT,
    therapist_id UUID,
    therapist_name TEXT,
    reviewer_name TEXT
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT sr.id, sr.user_id, sr.rating, sr.review_text, sr.is_visible, sr.created_at,
           sr.service_id, sr.therapist_id, sr.reviewer_display_name
    FROM public.spa_reviews sr
    WHERE sr.is_visible = true
      AND (_service_id IS NULL OR sr.service_id = _service_id)
  ),
  resolved AS (
    SELECT b.*,
      COALESCE(m.first_name, p.first_name, nm.first_name) AS first_name,
      COALESCE(m.last_name, p.last_name, nm.last_name) AS last_name,
      ss.name AS service_name,
      st.full_name AS therapist_name
    FROM base b
    LEFT JOIN public.members m ON m.user_id = b.user_id
    LEFT JOIN public.profiles p ON p.id = b.user_id
    LEFT JOIN public.non_member_profiles nm ON nm.user_id = b.user_id
    LEFT JOIN public.spa_services ss ON ss.id = b.service_id
    LEFT JOIN public.spa_therapists st ON st.id = b.therapist_id
  )
  SELECT
    id, rating, review_text, is_visible, created_at,
    service_id, service_name, therapist_id, therapist_name,
    CASE
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' AND COALESCE(NULLIF(TRIM(last_name), ''), '') = ''
        THEN COALESCE(
          CASE
            WHEN reviewer_display_name IS NULL THEN 'Guest'
            WHEN POSITION(' ' IN TRIM(reviewer_display_name)) = 0 THEN TRIM(reviewer_display_name)
            ELSE SPLIT_PART(TRIM(reviewer_display_name), ' ', 1) || ' ' || UPPER(LEFT(SPLIT_PART(TRIM(reviewer_display_name), ' ', 2), 1)) || '.'
          END,
          'Guest'
        )
      WHEN COALESCE(NULLIF(TRIM(last_name), ''), '') = '' THEN TRIM(first_name)
      WHEN COALESCE(NULLIF(TRIM(first_name), ''), '') = '' THEN TRIM(last_name)
      ELSE TRIM(first_name) || ' ' || UPPER(LEFT(TRIM(last_name), 1)) || '.'
    END AS reviewer_name
  FROM resolved
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_spa_reviews_with_names(UUID) TO anon, authenticated;
