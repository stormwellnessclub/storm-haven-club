-- Aella Sculpt progress tracking: provider-only treatment records and consent-gated progress photos.

CREATE OR REPLACE FUNCTION public.is_spa_provider(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin','admin','manager','spa_staff']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.sculpt_photo_consent_given(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.spa_photo_consents WHERE user_id = _user_id AND service_key = 'aella-sculpt' AND consent)
$$;

-- Storage path must start with a client id who has said yes to progress photography.
CREATE OR REPLACE FUNCTION public.sculpt_photo_path_allowed(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  BEGIN v_user := split_part(_name, '/', 1)::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.sculpt_photo_consent_given(v_user);
END $$;

CREATE TABLE public.spa_sculpt_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  user_id uuid,
  service_key text NOT NULL DEFAULT 'aella-sculpt',
  zone_name text,
  client_package_id uuid,
  recorded_on date NOT NULL,
  treatment_number integer,
  measurements jsonb NOT NULL DEFAULT '[]'::jsonb,
  modalities text[] NOT NULL DEFAULT '{}',
  client_response text,
  provider_notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spa_sculpt_progress_user_idx ON public.spa_sculpt_progress (user_id, recorded_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_sculpt_progress TO authenticated;
GRANT ALL ON public.spa_sculpt_progress TO service_role;
ALTER TABLE public.spa_sculpt_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spa providers manage sculpt progress" ON public.spa_sculpt_progress
  FOR ALL TO authenticated USING (public.is_spa_provider(auth.uid())) WITH CHECK (public.is_spa_provider(auth.uid()));

CREATE TABLE public.spa_sculpt_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES public.spa_sculpt_progress(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  view_label text NOT NULL DEFAULT 'Front',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spa_sculpt_progress_photos_progress_idx ON public.spa_sculpt_progress_photos (progress_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_sculpt_progress_photos TO authenticated;
GRANT ALL ON public.spa_sculpt_progress_photos TO service_role;
ALTER TABLE public.spa_sculpt_progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spa providers manage sculpt progress photos" ON public.spa_sculpt_progress_photos
  FOR ALL TO authenticated USING (public.is_spa_provider(auth.uid())) WITH CHECK (public.is_spa_provider(auth.uid()));

-- Fill authoritative fields from the appointment and validate what providers enter.
CREATE OR REPLACE FUNCTION public.spa_sculpt_progress_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt record; m jsonb;
BEGIN
  SELECT a.user_id, a.treatment_zone_name, a.client_package_id, a.appointment_date, s.service_key
    INTO v_appt
    FROM spa_appointments a LEFT JOIN spa_services s ON s.id::text = a.service_id::text
   WHERE a.id = NEW.appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.service_key IS DISTINCT FROM 'aella-sculpt' THEN RAISE EXCEPTION 'Progress tracking is only for Aella Sculpt appointments'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.appointment_id IS DISTINCT FROM OLD.appointment_id THEN RAISE EXCEPTION 'A progress record cannot move to another appointment'; END IF;

  NEW.user_id := v_appt.user_id;
  NEW.service_key := 'aella-sculpt';
  NEW.zone_name := coalesce(v_appt.treatment_zone_name, NEW.zone_name);
  NEW.client_package_id := v_appt.client_package_id;
  NEW.recorded_on := coalesce(NEW.recorded_on, v_appt.appointment_date);

  IF NEW.treatment_number IS NOT NULL AND (NEW.treatment_number < 1 OR NEW.treatment_number > 99) THEN
    RAISE EXCEPTION 'Treatment number must be between 1 and 99'; END IF;
  IF jsonb_typeof(NEW.measurements) <> 'array' OR jsonb_array_length(NEW.measurements) > 20 THEN
    RAISE EXCEPTION 'Measurements must be a list of up to 20 entries'; END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(NEW.measurements) LOOP
    IF coalesce(length(btrim(m->>'label')), 0) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Each measurement needs a name (60 characters max)'; END IF;
    IF jsonb_typeof(m->'value') <> 'number' OR (m->>'value')::numeric <= 0 OR (m->>'value')::numeric >= 1000 THEN RAISE EXCEPTION 'Measurement "%" needs a value above 0', m->>'label'; END IF;
    IF coalesce(m->>'unit', '') NOT IN ('in', 'cm') THEN RAISE EXCEPTION 'Measurement units must be inches or centimeters'; END IF;
  END LOOP;
  IF coalesce(array_length(NEW.modalities, 1), 0) > 20 THEN RAISE EXCEPTION 'Too many modalities'; END IF;
  IF length(coalesce(NEW.client_response, '')) > 4000 OR length(coalesce(NEW.provider_notes, '')) > 4000 THEN
    RAISE EXCEPTION 'Notes are limited to 4,000 characters'; END IF;

  NEW.recorded_by := auth.uid();
  SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) INTO NEW.recorded_by_name FROM profiles p WHERE p.user_id = auth.uid();
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); ELSE NEW.created_at := OLD.created_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER spa_sculpt_progress_before_write BEFORE INSERT OR UPDATE ON public.spa_sculpt_progress
  FOR EACH ROW EXECUTE FUNCTION public.spa_sculpt_progress_before_write();

-- Photos only with the client's current yes to progress photography, stored under that client's folder.
CREATE OR REPLACE FUNCTION public.spa_sculpt_progress_photo_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM spa_sculpt_progress WHERE id = NEW.progress_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Progress photos need a client account on the appointment'; END IF;
  IF NOT public.sculpt_photo_consent_given(v_user) THEN RAISE EXCEPTION 'The client has not agreed to progress photography'; END IF;
  IF split_part(NEW.storage_path, '/', 1) <> v_user::text THEN RAISE EXCEPTION 'Photo is filed under the wrong client'; END IF;
  IF length(btrim(coalesce(NEW.view_label, ''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Photo view name is required (40 characters max)'; END IF;
  NEW.user_id := v_user;
  NEW.uploaded_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER spa_sculpt_progress_photo_before_insert BEFORE INSERT ON public.spa_sculpt_progress_photos
  FOR EACH ROW EXECUTE FUNCTION public.spa_sculpt_progress_photo_before_insert();

CREATE OR REPLACE FUNCTION public.spa_sculpt_progress_photo_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.progress_id IS DISTINCT FROM OLD.progress_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'Only the photo view name can be changed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER spa_sculpt_progress_photo_lock BEFORE UPDATE ON public.spa_sculpt_progress_photos
  FOR EACH ROW EXECUTE FUNCTION public.spa_sculpt_progress_photo_lock();