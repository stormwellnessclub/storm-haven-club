CREATE TABLE public.spa_body_wrap_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid,
  full_name text,
  email text,
  phone text,
  address text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  health_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_details text,
  other_allergies text,
  medications text,
  goals text,
  ate_and_hydrated boolean,
  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurement_consent boolean NOT NULL DEFAULT false,
  signature_name text,
  signature_image text,
  signed_at timestamptz,
  guardian_name text,
  guardian_signature_image text,
  guardian_signed_at timestamptz,
  practitioner_signed_by uuid,
  practitioner_name text,
  practitioner_signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spa_body_wrap_intakes TO authenticated;
GRANT ALL ON public.spa_body_wrap_intakes TO service_role;
ALTER TABLE public.spa_body_wrap_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view body wrap intake" ON public.spa_body_wrap_intakes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert body wrap intake" ON public.spa_body_wrap_intakes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update body wrap intake" ON public.spa_body_wrap_intakes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff view body wrap intake" ON public.spa_body_wrap_intakes FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'front_desk') OR has_role(auth.uid(),'spa_staff'));
CREATE POLICY "Staff update body wrap intake" ON public.spa_body_wrap_intakes FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'spa_staff'));

CREATE OR REPLACE FUNCTION public.spa_body_wrap_intakes_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Clients cannot forge the practitioner sign-off
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'spa_staff')) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.practitioner_signed_by := NULL; NEW.practitioner_name := NULL; NEW.practitioner_signed_at := NULL;
    ELSE
      NEW.practitioner_signed_by := OLD.practitioner_signed_by; NEW.practitioner_name := OLD.practitioner_name; NEW.practitioner_signed_at := OLD.practitioner_signed_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_spa_body_wrap_intakes_guard BEFORE INSERT OR UPDATE ON public.spa_body_wrap_intakes FOR EACH ROW EXECUTE FUNCTION public.spa_body_wrap_intakes_guard();