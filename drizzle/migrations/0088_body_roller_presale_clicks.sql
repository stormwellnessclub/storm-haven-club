CREATE TABLE public.body_roller_presale_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  kind text NOT NULL,
  target text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.body_roller_presale_clicks TO authenticated;
GRANT ALL ON public.body_roller_presale_clicks TO service_role;
ALTER TABLE public.body_roller_presale_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view presale clicks" ON public.body_roller_presale_clicks FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE INDEX body_roller_presale_clicks_email_idx ON public.body_roller_presale_clicks (lower(email));