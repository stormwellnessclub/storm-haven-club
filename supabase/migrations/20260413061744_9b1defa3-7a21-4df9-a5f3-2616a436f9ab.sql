CREATE TABLE public.spa_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  service_name text NOT NULL,
  service_category text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spa_service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a service request"
  ON public.spa_service_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read service requests"
  ON public.spa_service_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));