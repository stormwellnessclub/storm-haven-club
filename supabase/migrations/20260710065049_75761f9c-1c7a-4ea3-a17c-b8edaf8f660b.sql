
-- 1) Extend instructors table
DO $$ BEGIN
  CREATE TYPE public.instructor_pay_type AS ENUM ('per_class','hourly','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS pay_type public.instructor_pay_type NOT NULL DEFAULT 'per_class',
  ADD COLUMN IF NOT EXISTS default_per_class_rate numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2) Auto-link on signup: when a new auth user's email matches an active instructor,
--    stamp instructors.user_id and grant class_instructor role.
CREATE OR REPLACE FUNCTION public.link_instructor_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_instructor_id
  FROM public.instructors
  WHERE lower(trim(email)) = lower(trim(NEW.email))
    AND is_active = true
    AND portal_enabled = true
    AND user_id IS NULL
  LIMIT 1;

  IF v_instructor_id IS NOT NULL THEN
    UPDATE public.instructors
       SET user_id = NEW.id,
           last_login_at = now()
     WHERE id = v_instructor_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'class_instructor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_instructor_on_signup ON auth.users;
CREATE TRIGGER trg_link_instructor_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_instructor_on_signup();

-- 3) Admin-invite RPC: marks instructor as invited so the UI can call the invite flow.
CREATE OR REPLACE FUNCTION public.admin_mark_instructor_invited(_instructor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin'::app_role)
       OR public.has_role(auth.uid(),'admin'::app_role)
       OR public.has_role(auth.uid(),'manager'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.instructors
     SET invited_at = now()
   WHERE id = _instructor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_instructor_invited(uuid) TO authenticated;
