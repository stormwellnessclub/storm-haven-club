-- 1) Member analytics: bind to staff or the member themselves.
ALTER FUNCTION public.calculate_health_score(uuid) RENAME TO _calculate_health_score_impl;
ALTER FUNCTION public.calculate_member_ltv(uuid) RENAME TO _calculate_member_ltv_impl;
ALTER FUNCTION public.calculate_engagement_score(uuid, integer) RENAME TO _calculate_engagement_score_impl;
ALTER FUNCTION public.calculate_churn_risk(uuid) RENAME TO _calculate_churn_risk_impl;
REVOKE ALL ON FUNCTION public._calculate_health_score_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._calculate_member_ltv_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._calculate_engagement_score_impl(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._calculate_churn_risk_impl(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._assert_member_insight_access(_member_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF COALESCE(auth.role(), '') = 'service_role' OR current_user NOT IN ('authenticated', 'anon') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.members m WHERE m.id = _member_id AND m.user_id = auth.uid()) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public._assert_member_insight_access(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calculate_health_score(_member_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_member_insight_access(_member_id);
  RETURN public._calculate_health_score_impl(_member_id);
END $$;

CREATE OR REPLACE FUNCTION public.calculate_member_ltv(p_member_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_member_insight_access(p_member_id);
  RETURN public._calculate_member_ltv_impl(p_member_id);
END $$;

CREATE OR REPLACE FUNCTION public.calculate_engagement_score(p_member_id uuid, p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_member_insight_access(p_member_id);
  RETURN public._calculate_engagement_score_impl(p_member_id, p_days);
END $$;

CREATE OR REPLACE FUNCTION public.calculate_churn_risk(p_member_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_member_insight_access(p_member_id);
  RETURN public._calculate_churn_risk_impl(p_member_id);
END $$;

REVOKE ALL ON FUNCTION public.calculate_health_score(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calculate_member_ltv(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calculate_engagement_score(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calculate_churn_risk(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_health_score(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_member_ltv(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_engagement_score(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_churn_risk(uuid) TO authenticated, service_role;

-- 2) Café reviews: "verified purchase" only for the reviewer's own order.
CREATE OR REPLACE FUNCTION public.cafe_reviews_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.reviewer_display_name := NULLIF(TRIM(NEW.reviewer_display_name), '');
  IF NEW.reviewer_display_name IS NULL THEN
    RAISE EXCEPTION 'A display name is required to submit a café review.';
  END IF;
  IF LENGTH(NEW.reviewer_display_name) > 60 THEN
    NEW.reviewer_display_name := LEFT(NEW.reviewer_display_name, 60);
  END IF;
  IF NEW.comment IS NOT NULL AND LENGTH(NEW.comment) > 1000 THEN
    NEW.comment := LEFT(NEW.comment, 1000);
  END IF;
  IF NEW.tags IS NULL THEN
    NEW.tags := '{}'::TEXT[];
  END IF;
  IF array_length(NEW.tags, 1) > 8 THEN
    NEW.tags := NEW.tags[1:8];
  END IF;
  NEW.is_verified_purchase :=
    NEW.order_id IS NOT NULL
    AND NEW.reviewer_user_id IS NOT NULL
    AND (current_user NOT IN ('authenticated', 'anon') OR NEW.reviewer_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.cafe_orders o
      LEFT JOIN public.members m ON m.id = o.member_id
      WHERE o.id = NEW.order_id
        AND (o.user_id = NEW.reviewer_user_id OR m.user_id = NEW.reviewer_user_id)
    );
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 3) Money owed: no one, super admins included, edits their own arrears row.
CREATE OR REPLACE FUNCTION public.guard_own_billing_arrears()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_member uuid := COALESCE(NEW.member_id, OLD.member_id);
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = v_member AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot change billing balances on your own account' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;

-- 4) Shift auto-close runs only from the nightly job.
REVOKE ALL ON FUNCTION public.frontdesk_auto_close_stale_shifts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.frontdesk_auto_close_stale_shifts() TO service_role;