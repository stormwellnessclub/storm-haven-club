
-- 1. Update Duha's instructor email
UPDATE public.instructors SET email = 'duha@stormwellnessclub.com' WHERE LOWER(email) = 'duha@stormclub.com';

-- 2. Create staff_invites table
CREATE TABLE public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  roles app_role[] NOT NULL DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

-- 3. Enable RLS
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- 4. RLS: only admin/super_admin can manage invites
CREATE POLICY "Admins can manage staff invites"
  ON public.staff_invites
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

-- 5. Trigger: auto-assign roles from staff_invites when a new profile is created
CREATE OR REPLACE FUNCTION public.auto_assign_staff_roles_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invite RECORD;
  v_role app_role;
BEGIN
  -- Find pending invite matching this email
  SELECT * INTO v_invite
  FROM public.staff_invites
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Insert each role from the invite
    FOREACH v_role IN ARRAY v_invite.roles LOOP
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, v_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;

    -- Mark invite as claimed
    UPDATE public.staff_invites
    SET status = 'claimed', claimed_at = now()
    WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_staff_roles
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_staff_roles_on_signup();
