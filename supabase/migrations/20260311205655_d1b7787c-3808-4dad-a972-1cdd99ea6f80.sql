
-- Add RLS policies for class_instructor on class_bookings
CREATE POLICY "class_instructor_select_bookings"
ON public.class_bookings FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'class_instructor') AND
  session_id IN (
    SELECT id FROM public.class_sessions
    WHERE instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
  )
);

-- class_instructor can update bookings for their sessions (check-in, status)
CREATE POLICY "class_instructor_update_bookings"
ON public.class_bookings FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'class_instructor') AND
  session_id IN (
    SELECT id FROM public.class_sessions
    WHERE instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
  )
);

-- class_instructor can view their assigned sessions
CREATE POLICY "class_instructor_select_sessions"
ON public.class_sessions FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'class_instructor') AND
  instructor_id IN (
    SELECT id FROM public.instructors WHERE user_id = auth.uid()
  )
);

-- cafe_staff can select cafe orders
CREATE POLICY "cafe_staff_select_orders"
ON public.cafe_orders FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['cafe_staff']::app_role[])
);

-- cafe_staff can insert cafe orders
CREATE POLICY "cafe_staff_insert_orders"
ON public.cafe_orders FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['cafe_staff']::app_role[])
);

-- cafe_staff can update cafe orders
CREATE POLICY "cafe_staff_update_orders"
ON public.cafe_orders FOR UPDATE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['cafe_staff']::app_role[])
);

-- front_desk can view profiles for member lookup
CREATE POLICY "front_desk_select_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['front_desk', 'manager']::app_role[])
);

-- admin role can view user_roles for staff management
CREATE POLICY "admin_select_user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
);
