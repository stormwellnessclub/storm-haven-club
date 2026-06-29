-- ============================================================================
-- gut_reset_sessions: scheduled reset cohorts the public can browse
-- ============================================================================
CREATE TABLE public.gut_reset_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  length_days int NOT NULL,
  capacity int,
  spots_taken int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gut_reset_sessions_length_check CHECK (length_days IN (3, 5)),
  CONSTRAINT gut_reset_sessions_status_check CHECK (status IN ('scheduled', 'cancelled', 'completed'))
);

CREATE INDEX gut_reset_sessions_start_date_idx ON public.gut_reset_sessions (start_date);
CREATE INDEX gut_reset_sessions_status_idx ON public.gut_reset_sessions (status);

GRANT SELECT ON public.gut_reset_sessions TO anon;
GRANT SELECT ON public.gut_reset_sessions TO authenticated;
GRANT ALL ON public.gut_reset_sessions TO service_role;

ALTER TABLE public.gut_reset_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view scheduled or completed sessions"
  ON public.gut_reset_sessions FOR SELECT
  USING (status IN ('scheduled', 'completed'));

CREATE POLICY "Admins can view all sessions"
  ON public.gut_reset_sessions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins can insert sessions"
  ON public.gut_reset_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins can update sessions"
  ON public.gut_reset_sessions FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins can delete sessions"
  ON public.gut_reset_sessions FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_gut_reset_sessions_updated_at
  BEFORE UPDATE ON public.gut_reset_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- gut_reset_purchases: customer orders tied to a session
-- ============================================================================
CREATE TABLE public.gut_reset_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gut_reset_sessions(id) ON DELETE RESTRICT,
  option text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  user_id uuid,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gut_reset_purchases_option_check CHECK (option IN ('3day', '5day')),
  CONSTRAINT gut_reset_purchases_status_check CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled'))
);

CREATE INDEX gut_reset_purchases_session_idx ON public.gut_reset_purchases (session_id);
CREATE INDEX gut_reset_purchases_email_idx ON public.gut_reset_purchases (customer_email);
CREATE INDEX gut_reset_purchases_user_idx ON public.gut_reset_purchases (user_id);

GRANT SELECT ON public.gut_reset_purchases TO authenticated;
GRANT ALL ON public.gut_reset_purchases TO service_role;

ALTER TABLE public.gut_reset_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.gut_reset_purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR lower(customer_email) = public.current_user_email_lower());

CREATE POLICY "Admins can view all purchases"
  ON public.gut_reset_purchases FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins can update purchases"
  ON public.gut_reset_purchases FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE TRIGGER trg_gut_reset_purchases_updated_at
  BEFORE UPDATE ON public.gut_reset_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();