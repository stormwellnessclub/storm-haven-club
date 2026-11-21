-- Security pass 2 (Nov 21 2026).

-- 1) Booking blocks: a manager or admin who is on the blocked list could
--    edit or delete their own block. Only a super admin may change a block
--    that names the caller (by account email or linked member record).
CREATE OR REPLACE FUNCTION public.guard_own_blocked_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  IF lower(OLD.email) = v_email
     OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = OLD.member_id AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot change a booking block on your own account' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_own_blocked_person() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_blocked_persons_guard_own ON public.blocked_persons;
CREATE TRIGGER trg_blocked_persons_guard_own
  BEFORE UPDATE OR DELETE ON public.blocked_persons
  FOR EACH ROW EXECUTE FUNCTION public.guard_own_blocked_person();

-- 2) Guest profiles: a signed-in user could set their own
--    non_member_profiles.stripe_customer_id to another person's Stripe
--    customer and then charge that card as "their own". Card fields are set
--    only by server code (service role) and staff.
CREATE OR REPLACE FUNCTION public.guard_non_member_card_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_non_member_card_fields_guard ON public.non_member_profiles;
CREATE TRIGGER trg_non_member_card_fields_guard
  BEFORE INSERT OR UPDATE ON public.non_member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_non_member_card_fields();
