-- Correction to 0199/0200: those guard triggers were SECURITY DEFINER, so inside
-- them current_user is always the function owner and the
-- "current_user NOT IN ('authenticated','anon')" bypass let every caller through.
-- As SECURITY INVOKER, current_user is 'authenticated'/'anon' for direct API
-- writes and the owner when the write comes from server code or a
-- SECURITY DEFINER function, which is the intended behaviour.

CREATE OR REPLACE FUNCTION public.guard_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

CREATE OR REPLACE FUNCTION public.guard_non_member_card_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stripe_customer_id IS NOT NULL OR NEW.card_last4 IS NOT NULL OR NEW.card_brand IS NOT NULL
       OR NEW.card_exp_month IS NOT NULL OR NEW.card_exp_year IS NOT NULL OR NEW.merged_into_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Not allowed to set card details on a profile' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.card_last4 IS DISTINCT FROM OLD.card_last4
     OR NEW.card_brand IS DISTINCT FROM OLD.card_brand
     OR NEW.card_exp_month IS DISTINCT FROM OLD.card_exp_month
     OR NEW.card_exp_year IS DISTINCT FROM OLD.card_exp_year
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.merged_into_user_id IS DISTINCT FROM OLD.merged_into_user_id THEN
    RAISE EXCEPTION 'Not allowed to change card details on a profile' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_non_member_card_fields() FROM PUBLIC, anon, authenticated;

-- Privileged lookup for the referral guard (members cannot see other people's
-- member/application rows under row security). Returns only a yes/no, which
-- the referral insert already reveals through its error message.
CREATE OR REPLACE FUNCTION public.referral_email_taken(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m WHERE lower(m.email) = lower(btrim(_email)))
      OR EXISTS (SELECT 1 FROM public.membership_applications a WHERE lower(a.email) = lower(btrim(_email)));
$$;
REVOKE ALL ON FUNCTION public.referral_email_taken(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_email_taken(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_member_referral_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

  IF public.referral_email_taken(NEW.referred_email) THEN
    RAISE EXCEPTION 'This person is already a member or has already applied' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_member_referral_rows() FROM PUBLIC, anon, authenticated;