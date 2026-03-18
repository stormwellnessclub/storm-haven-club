
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only super_admin/admin can read system config
CREATE POLICY "Admins can read system config"
ON public.system_config
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

-- No direct insert/update/delete from client - only edge functions (service role) can write
