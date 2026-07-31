-- 1) instructors: hide contact + pay columns from ordinary authenticated users
REVOKE SELECT (email, phone, hourly_rate, default_per_class_rate, pay_type, last_login_at, invited_at)
  ON public.instructors FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_instructor_profile()
RETURNS SETOF public.instructors
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.instructors WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_instructor_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_instructor_profile() TO authenticated;

-- 2) kids_care_hour_slots: hide staff-only fields from members/public (incl. realtime payloads)
REVOKE SELECT (staff_name, notes, created_by) ON public.kids_care_hour_slots FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_kids_care_hour_slots_staff(p_start date, p_end date)
RETURNS SETOF public.kids_care_hour_slots
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.*
  FROM public.kids_care_hour_slots s
  WHERE has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','childcare_staff','front_desk']::app_role[])
    AND s.slot_date >= p_start
    AND s.slot_date <= p_end
  ORDER BY s.slot_date, s.open_time;
$$;
REVOKE EXECUTE ON FUNCTION public.get_kids_care_hour_slots_staff(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kids_care_hour_slots_staff(date, date) TO authenticated;

-- 3) member_credits: consolidate overlapping SELECT policies
DROP POLICY IF EXISTS "Members can view own credits" ON public.member_credits;
DROP POLICY IF EXISTS "Non-members can view own credits" ON public.member_credits;
DROP POLICY IF EXISTS "Users can view their own credits" ON public.member_credits;
DROP POLICY IF EXISTS "Staff can view member credits" ON public.member_credits;

CREATE POLICY "Users can view their own credits"
  ON public.member_credits FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid())
  );

CREATE POLICY "Staff can view member credits"
  ON public.member_credits FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));