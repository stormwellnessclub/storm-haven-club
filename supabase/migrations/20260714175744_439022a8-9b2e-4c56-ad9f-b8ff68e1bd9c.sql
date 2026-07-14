
CREATE OR REPLACE FUNCTION public.link_instructor_on_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor_id uuid;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_instructor_id FROM public.instructors
   WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF v_instructor_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.instructors SET user_id = NEW.id
   WHERE id = v_instructor_id AND (user_id IS NULL OR user_id <> NEW.id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'class_instructor'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_instructor_on_auth_ins ON auth.users;
CREATE TRIGGER trg_link_instructor_on_auth_ins
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_instructor_on_auth();

DROP TRIGGER IF EXISTS trg_link_instructor_on_auth_upd ON auth.users;
CREATE TRIGGER trg_link_instructor_on_auth_upd
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_instructor_on_auth();

UPDATE public.instructors i
SET user_id = u.id
FROM auth.users u
WHERE i.user_id IS NULL AND lower(i.email) = lower(u.email);

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT i.user_id, 'class_instructor'::app_role
FROM public.instructors i
WHERE i.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_instructor_portal_status()
RETURNS TABLE (instructor_id uuid, has_auth_account boolean, has_portal_role boolean, linked_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    (u.id IS NOT NULL) AS has_auth_account,
    EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = COALESCE(i.user_id, u.id) AND r.role = 'class_instructor'::app_role
    ) AS has_portal_role,
    COALESCE(i.user_id, u.id) AS linked_user_id
  FROM public.instructors i
  LEFT JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]);
$$;

REVOKE EXECUTE ON FUNCTION public.get_instructor_portal_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_instructor_portal_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_instructor_portal(_instructor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT email INTO v_email FROM public.instructors WHERE id = _instructor_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'instructor_not_found');
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth_account', 'email', v_email);
  END IF;
  UPDATE public.instructors SET user_id = v_user_id
   WHERE id = _instructor_id AND (user_id IS NULL OR user_id <> v_user_id);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'class_instructor'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_instructor_portal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_instructor_portal(uuid) TO authenticated;
