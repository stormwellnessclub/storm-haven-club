CREATE TABLE public.exercise_form_guides (
  name_key text PRIMARY KEY,
  display_name text NOT NULL,
  guide jsonb NOT NULL,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_form_guides TO authenticated;
GRANT ALL ON public.exercise_form_guides TO service_role;
ALTER TABLE public.exercise_form_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read form guides" ON public.exercise_form_guides FOR SELECT TO authenticated USING (true);