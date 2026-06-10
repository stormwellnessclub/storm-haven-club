
DO $$ BEGIN
  CREATE TYPE public.pt_format AS ENUM ('one_on_one','reformer_one_on_one','semi_private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pt_pass_status AS ENUM ('active','exhausted','expired','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pt_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format public.pt_format NOT NULL,
  name text NOT NULL,
  sessions integer NOT NULL CHECK (sessions > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  expiration_days integer NOT NULL CHECK (expiration_days > 0),
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pt_packs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_packs TO authenticated;
GRANT ALL ON public.pt_packs TO service_role;

ALTER TABLE public.pt_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active public PT packs"
  ON public.pt_packs FOR SELECT
  USING (is_active = true AND is_public = true);

CREATE POLICY "Staff can view all PT packs"
  ON public.pt_packs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins manage PT packs"
  ON public.pt_packs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));

CREATE TABLE IF NOT EXISTS public.pt_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.pt_packs(id) ON DELETE SET NULL,
  format public.pt_format NOT NULL,
  pack_name text NOT NULL,
  sessions_total integer NOT NULL CHECK (sessions_total > 0),
  sessions_remaining integer NOT NULL CHECK (sessions_remaining >= 0),
  price_cents_charged integer NOT NULL DEFAULT 0,
  activated_at date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Chicago')::date,
  expires_at date NOT NULL,
  status public.pt_pass_status NOT NULL DEFAULT 'active',
  stripe_payment_intent_id text,
  payment_method text,
  sold_by_admin_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pt_passes_user_id_idx ON public.pt_passes(user_id);
CREATE INDEX IF NOT EXISTS pt_passes_status_idx ON public.pt_passes(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_passes TO authenticated;
GRANT ALL ON public.pt_passes TO service_role;

ALTER TABLE public.pt_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own PT passes"
  ON public.pt_passes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff view all PT passes"
  ON public.pt_passes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE POLICY "Staff manage PT passes"
  ON public.pt_passes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE TABLE IF NOT EXISTS public.pt_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.pt_passes(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  used_by_admin_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pt_session_usage_pass_idx ON public.pt_session_usage(pass_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_session_usage TO authenticated;
GRANT ALL ON public.pt_session_usage TO service_role;

ALTER TABLE public.pt_session_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own PT usage"
  ON public.pt_session_usage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pt_passes p WHERE p.id = pass_id AND p.user_id = auth.uid()));

CREATE POLICY "Staff manage PT usage"
  ON public.pt_session_usage FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE OR REPLACE FUNCTION public.pt_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS pt_packs_updated_at ON public.pt_packs;
CREATE TRIGGER pt_packs_updated_at BEFORE UPDATE ON public.pt_packs
  FOR EACH ROW EXECUTE FUNCTION public.pt_set_updated_at();

DROP TRIGGER IF EXISTS pt_passes_updated_at ON public.pt_passes;
CREATE TRIGGER pt_passes_updated_at BEFORE UPDATE ON public.pt_passes
  FOR EACH ROW EXECUTE FUNCTION public.pt_set_updated_at();

CREATE OR REPLACE FUNCTION public.use_pt_session(
  _pass_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pass public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _pass FROM public.pt_passes WHERE id = _pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pass not found'; END IF;
  IF _pass.status <> 'active' THEN RAISE EXCEPTION 'Pass is not active'; END IF;
  IF _pass.sessions_remaining <= 0 THEN RAISE EXCEPTION 'No sessions remaining'; END IF;
  IF _pass.expires_at < (now() AT TIME ZONE 'America/Chicago')::date THEN
    UPDATE public.pt_passes SET status = 'expired' WHERE id = _pass_id;
    RAISE EXCEPTION 'Pass expired';
  END IF;

  UPDATE public.pt_passes
  SET sessions_remaining = sessions_remaining - 1,
      status = CASE WHEN sessions_remaining - 1 = 0 THEN 'exhausted'::pt_pass_status ELSE status END
  WHERE id = _pass_id;

  INSERT INTO public.pt_session_usage(pass_id, used_by_admin_id, notes)
  VALUES (_pass_id, auth.uid(), _notes);

  RETURN jsonb_build_object('success', true, 'sessions_remaining', _pass.sessions_remaining - 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_pt_session(uuid, text) TO authenticated;

INSERT INTO public.pt_packs (format, name, sessions, price_cents, expiration_days, is_public, is_active, display_order, notes) VALUES
  ('one_on_one','Single Session', 1, 12000, 14, true, true, 10, NULL),
  ('one_on_one','10-Pack',       10,110000, 90, true, true, 20, '$110/session'),
  ('reformer_one_on_one','Single Session', 1, 11000, 14, true, true, 10, NULL),
  ('reformer_one_on_one','5-Pack',         5,     0, 60, true, false, 20, 'Price TBD'),
  ('reformer_one_on_one','10-Pack',       10,     0, 90, true, false, 30, 'Price TBD'),
  ('semi_private','Single Session', 1,  5500, 14, false, true,  5, 'Admin-only — hidden from public site'),
  ('semi_private','10-Pack',       10, 55000, 90, true,  true, 10, '$55/session'),
  ('semi_private','20-Pack',       20,110000,120, true,  true, 20, '$55/session'),
  ('semi_private','30-Pack',       30,165000,150, true,  true, 30, '$55/session'),
  ('semi_private','45-Pack',       45,225000,180, true,  true, 40, '$50/session');
