-- Staff placeholders: schedulable people without auth/invite
CREATE TABLE public.staff_placeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  roles app_role[] NOT NULL DEFAULT '{}'::app_role[],
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_placeholders_archived ON public.staff_placeholders(archived);

ALTER TABLE public.staff_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff placeholders"
  ON public.staff_placeholders
  FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE TRIGGER trg_staff_placeholders_updated_at
  BEFORE UPDATE ON public.staff_placeholders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();