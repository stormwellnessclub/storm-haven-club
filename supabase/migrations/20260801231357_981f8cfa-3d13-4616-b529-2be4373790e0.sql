-- 1) Trigger functions should never be directly callable
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 2) Revoke anonymous execute on privileged RPCs
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND (p.proname LIKE 'admin\_%' OR p.proname LIKE 'kiosk\_%' OR p.proname LIKE 'frontdesk\_%'
           OR p.proname IN ('cancel_scheduled_gift_card','reschedule_gift_card','delete_class_type',
                            'delete_pt_pack','effective_waiver_status','settle_membership_dues_payment',
                            'grant_monthly_membership_credit','generate_gift_card_code','get_my_gift_cards',
                            'get_instructor_portal_status','ensure_spa_review_token','check_freeze_block_status',
                            'increment_promotion_redemption','redeem_gift_card','verify_kiosk_pin'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- 3) Explicit deny-by-default + admin access on PIN/kiosk config tables
REVOKE ALL ON public.staff_pins, public.staff_pin_attempts, public.kiosk_settings FROM anon, authenticated;
GRANT ALL ON public.staff_pins, public.staff_pin_attempts, public.kiosk_settings TO service_role;

DROP POLICY IF EXISTS "Admins manage staff pins" ON public.staff_pins;
CREATE POLICY "Admins manage staff pins" ON public.staff_pins
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

DROP POLICY IF EXISTS "Admins manage pin attempts" ON public.staff_pin_attempts;
CREATE POLICY "Admins manage pin attempts" ON public.staff_pin_attempts
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

DROP POLICY IF EXISTS "Admins manage kiosk settings" ON public.kiosk_settings;
CREATE POLICY "Admins manage kiosk settings" ON public.kiosk_settings
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- 4) Remove redundant always-true service_role policies (service_role bypasses RLS)
DROP POLICY IF EXISTS "Service role manages class achievements" ON public.user_class_achievements;
DROP POLICY IF EXISTS "Service role manages monthly credit grants" ON public.monthly_credit_grants;