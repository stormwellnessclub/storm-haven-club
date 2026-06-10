
CREATE TABLE public.training_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_times TEXT,
  experience_level TEXT,
  goals TEXT,
  is_member BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  submitted_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_requests TO authenticated;
GRANT INSERT ON public.training_requests TO anon;
GRANT ALL ON public.training_requests TO service_role;

ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a training request"
ON public.training_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view training requests"
ON public.training_requests
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins can update training requests"
ON public.training_requests
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins can delete training requests"
ON public.training_requests
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE TRIGGER update_training_requests_updated_at
BEFORE UPDATE ON public.training_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_training_requests_status ON public.training_requests(status);
CREATE INDEX idx_training_requests_created_at ON public.training_requests(created_at DESC);
