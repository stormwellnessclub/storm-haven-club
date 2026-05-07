
-- Extend existing marketing_contacts table
ALTER TABLE public.marketing_contacts
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'prospect' CHECK (segment IN ('member','non_member','prospect')),
  ADD COLUMN IF NOT EXISTS linked_non_member_id UUID REFERENCES public.non_member_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS marketing_contacts_segment_idx ON public.marketing_contacts (segment);
CREATE INDEX IF NOT EXISTS marketing_contacts_source_label_idx ON public.marketing_contacts (source_label);

-- Recompute segment for an email
CREATE OR REPLACE FUNCTION public.recompute_marketing_contact_segment(_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_id UUID;
  nm_id UUID;
BEGIN
  IF _email IS NULL OR _email = '' THEN RETURN; END IF;

  SELECT id INTO m_id FROM public.members WHERE LOWER(email) = LOWER(_email) LIMIT 1;
  IF m_id IS NOT NULL THEN
    UPDATE public.marketing_contacts
      SET segment = 'member', linked_member_id = m_id, linked_non_member_id = NULL
      WHERE LOWER(email) = LOWER(_email);
    RETURN;
  END IF;

  SELECT id INTO nm_id FROM public.non_member_profiles WHERE LOWER(email) = LOWER(_email) LIMIT 1;
  IF nm_id IS NOT NULL THEN
    UPDATE public.marketing_contacts
      SET segment = 'non_member', linked_non_member_id = nm_id, linked_member_id = NULL
      WHERE LOWER(email) = LOWER(_email);
    RETURN;
  END IF;

  UPDATE public.marketing_contacts
    SET segment = 'prospect', linked_member_id = NULL, linked_non_member_id = NULL
    WHERE LOWER(email) = LOWER(_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_marketing_contact_from_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_marketing_contact_segment(OLD.email);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_marketing_contact_segment(NEW.email);
  IF TG_OP = 'UPDATE' AND LOWER(COALESCE(OLD.email,'')) <> LOWER(COALESCE(NEW.email,'')) THEN
    PERFORM public.recompute_marketing_contact_segment(OLD.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_marketing_contact_member ON public.members;
CREATE TRIGGER trg_sync_marketing_contact_member
  AFTER INSERT OR UPDATE OF email OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.sync_marketing_contact_from_member();

CREATE OR REPLACE FUNCTION public.sync_marketing_contact_from_non_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.email IS NOT NULL THEN
      PERFORM public.recompute_marketing_contact_segment(OLD.email);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.email IS NOT NULL THEN
    PERFORM public.recompute_marketing_contact_segment(NEW.email);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email IS NOT NULL AND LOWER(COALESCE(OLD.email,'')) <> LOWER(COALESCE(NEW.email,'')) THEN
    PERFORM public.recompute_marketing_contact_segment(OLD.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_marketing_contact_non_member ON public.non_member_profiles;
CREATE TRIGGER trg_sync_marketing_contact_non_member
  AFTER INSERT OR UPDATE OF email OR DELETE ON public.non_member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_marketing_contact_from_non_member();

-- Preview RPC
CREATE OR REPLACE FUNCTION public.preview_marketing_contacts(rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INT := 0;
  invalid_count INT := 0;
  within_dupes INT := 0;
  already_count INT := 0;
  member_count INT := 0;
  non_member_count INT := 0;
  prospect_count INT := 0;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH input AS (
    SELECT LOWER(TRIM(r->>'email')) AS email, ROW_NUMBER() OVER () AS rn
    FROM jsonb_array_elements(rows) r
  ),
  classified AS (
    SELECT email, rn,
      (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') AS valid,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY rn) AS dup_rn
    FROM input
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT COALESCE(valid,false) OR email IS NULL OR email = ''),
    COUNT(*) FILTER (WHERE valid AND dup_rn > 1),
    COUNT(*) FILTER (WHERE valid AND dup_rn = 1 AND EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email)),
    COUNT(*) FILTER (WHERE valid AND dup_rn = 1 AND NOT EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email) AND EXISTS (SELECT 1 FROM members m WHERE LOWER(m.email) = c.email)),
    COUNT(*) FILTER (WHERE valid AND dup_rn = 1 AND NOT EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email) AND NOT EXISTS (SELECT 1 FROM members m WHERE LOWER(m.email) = c.email) AND EXISTS (SELECT 1 FROM non_member_profiles n WHERE LOWER(n.email) = c.email)),
    COUNT(*) FILTER (WHERE valid AND dup_rn = 1 AND NOT EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email) AND NOT EXISTS (SELECT 1 FROM members m WHERE LOWER(m.email) = c.email) AND NOT EXISTS (SELECT 1 FROM non_member_profiles n WHERE LOWER(n.email) = c.email))
  INTO total, invalid_count, within_dupes, already_count, member_count, non_member_count, prospect_count
  FROM classified c;

  RETURN jsonb_build_object(
    'total', total,
    'invalid', invalid_count,
    'within_file_duplicates', within_dupes,
    'already_in_table', already_count,
    'will_insert_member', member_count,
    'will_insert_non_member', non_member_count,
    'will_insert_prospect', prospect_count,
    'will_insert_total', member_count + non_member_count + prospect_count
  );
END;
$$;

-- Import RPC
CREATE OR REPLACE FUNCTION public.import_marketing_contacts(rows JSONB, _source_label TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_member INT := 0;
  inserted_non_member INT := 0;
  inserted_prospect INT := 0;
  skipped_invalid INT := 0;
  skipped_duplicate INT := 0;
  skipped_existing INT := 0;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH input AS (
    SELECT
      LOWER(TRIM(r->>'email')) AS email,
      NULLIF(TRIM(r->>'first_name'),'') AS first_name,
      NULLIF(TRIM(r->>'last_name'),'') AS last_name,
      NULLIF(TRIM(r->>'phone'),'') AS phone,
      COALESCE(r->'metadata', '{}'::jsonb) AS metadata,
      ROW_NUMBER() OVER () AS rn
    FROM jsonb_array_elements(rows) r
  ),
  deduped AS (
    SELECT *,
      (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') AS valid,
      ROW_NUMBER() OVER (PARTITION BY email ORDER BY rn) AS dup_rn
    FROM input
  ),
  candidates AS (
    SELECT * FROM deduped WHERE valid AND dup_rn = 1
  ),
  to_insert AS (
    SELECT c.*,
      (SELECT id FROM members m WHERE LOWER(m.email) = c.email LIMIT 1) AS member_id,
      (SELECT id FROM non_member_profiles n WHERE LOWER(n.email) = c.email LIMIT 1) AS non_member_id
    FROM candidates c
    WHERE NOT EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email)
  ),
  ins AS (
    INSERT INTO marketing_contacts (email, first_name, last_name, phone, segment, source, source_label, linked_member_id, linked_non_member_id, external_metadata, opted_in_email)
    SELECT
      email, first_name, last_name, phone,
      CASE WHEN member_id IS NOT NULL THEN 'member'
           WHEN non_member_id IS NOT NULL THEN 'non_member'
           ELSE 'prospect' END,
      'import'::marketing_source,
      _source_label,
      member_id, non_member_id, metadata, true
    FROM to_insert
    RETURNING segment
  )
  SELECT
    (SELECT COUNT(*) FROM deduped WHERE NOT COALESCE(valid,false) OR email IS NULL OR email = ''),
    (SELECT COUNT(*) FROM deduped WHERE valid AND dup_rn > 1),
    (SELECT COUNT(*) FROM candidates c WHERE EXISTS (SELECT 1 FROM marketing_contacts mc WHERE LOWER(mc.email) = c.email)),
    COUNT(*) FILTER (WHERE segment = 'member'),
    COUNT(*) FILTER (WHERE segment = 'non_member'),
    COUNT(*) FILTER (WHERE segment = 'prospect')
  INTO skipped_invalid, skipped_duplicate, skipped_existing, inserted_member, inserted_non_member, inserted_prospect
  FROM ins;

  RETURN jsonb_build_object(
    'inserted_member', inserted_member,
    'inserted_non_member', inserted_non_member,
    'inserted_prospect', inserted_prospect,
    'inserted_total', inserted_member + inserted_non_member + inserted_prospect,
    'skipped_existing', skipped_existing,
    'skipped_invalid', skipped_invalid,
    'skipped_duplicate', skipped_duplicate
  );
END;
$$;
