-- Security pass 3 (Nov 21 2026): "Users can award themselves a role, money, or a win".

-- 1) Roles: any admin could insert super_admin (or admin) for themselves, and
--    super_admin skips every "not on your own account" guard. Now only a
--    super admin may grant/change/remove admin or super_admin rows, and only a
--    super admin may change their own roles. Server code (service role) and
--    SECURITY DEFINER functions (e.g. admin_grant_instructor_portal) are unaffected.
CREATE OR REPLACE FUNCTION public.guard_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_old public.user_roles := OLD;
  r_new public.user_roles := NEW;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF (TG_OP <> 'INSERT' AND r_old.user_id = auth.uid())
     OR (TG_OP <> 'DELETE' AND r_new.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot change your own roles' USING ERRCODE = '42501';
  END IF;
  IF (TG_OP <> 'INSERT' AND r_old.role::text IN ('super_admin', 'admin'))
     OR (TG_OP <> 'DELETE' AND r_new.role::text IN ('super_admin', 'admin')) THEN
    RAISE EXCEPTION 'Only a super admin can grant or remove admin access' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_user_role_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_roles_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_changes();

-- 2) Referrals: members could insert their own referral rows already marked
--    'active' (inflating milestone bonuses that redeem for café credit, class
--    credits and guest passes) or claim people already applying. A member's
--    new referral always starts 'pending' with no points, must be for someone
--    not already a member or applicant, and members can't edit referral rows.
CREATE OR REPLACE FUNCTION public.guard_member_referral_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Referrals can only be updated by the club' USING ERRCODE = '42501';
  END IF;

  NEW.referred_email := lower(btrim(NEW.referred_email));
  NEW.status := 'pending';
  NEW.referred_member_id := NULL;
  NEW.points_awarded := 0;
  NEW.points_awarded_at := NULL;

  IF EXISTS (SELECT 1 FROM public.members m WHERE lower(m.email) = NEW.referred_email)
     OR EXISTS (SELECT 1 FROM public.membership_applications a WHERE lower(a.email) = NEW.referred_email) THEN
    RAISE EXCEPTION 'This person is already a member or has already applied' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_member_referral_rows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_member_referrals_guard ON public.member_referrals;
CREATE TRIGGER trg_member_referrals_guard
  BEFORE INSERT OR UPDATE ON public.member_referrals
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_referral_rows();
