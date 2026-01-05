-- Member Activities Table for Unified Activity Tracking
-- Tracks all member interactions and activities in one place

CREATE TABLE public.member_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'class_attended', 'spa_service', 'workout_logged', 'check_in', 'cafe_order', 'kids_care_booking', 'payment', 'status_change'
  activity_data JSONB NOT NULL DEFAULT '{}', -- Flexible data storage for activity-specific details
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.member_activities ENABLE ROW LEVEL SECURITY;

-- Members can view their own activities
CREATE POLICY "Members can view their own activities"
ON public.member_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_activities.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all activities
CREATE POLICY "Staff can view all activities"
ON public.member_activities
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Only system can insert activities (via triggers/functions)
CREATE POLICY "System can insert activities"
ON public.member_activities
FOR INSERT
WITH CHECK (true); -- Controlled via SECURITY DEFINER functions

-- Create indexes for efficient queries
CREATE INDEX idx_member_activities_member_id ON public.member_activities(member_id);
CREATE INDEX idx_member_activities_activity_type ON public.member_activities(activity_type);
CREATE INDEX idx_member_activities_created_at ON public.member_activities(created_at DESC);
CREATE INDEX idx_member_activities_member_created ON public.member_activities(member_id, created_at DESC);

-- Function to log class attendance
CREATE OR REPLACE FUNCTION public.log_class_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log when booking is checked in (completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.member_activities (
      member_id,
      activity_type,
      activity_data,
      points_earned
    )
    SELECT
      NEW.member_id,
      'class_attended',
      jsonb_build_object(
        'booking_id', NEW.id,
        'session_id', NEW.session_id,
        'class_name', (SELECT ct.name FROM public.class_sessions cs JOIN public.class_types ct ON cs.class_type_id = ct.id WHERE cs.id = NEW.session_id),
        'session_date', (SELECT session_date FROM public.class_sessions WHERE id = NEW.session_id),
        'instructor', (SELECT i.first_name || ' ' || i.last_name FROM public.class_sessions cs JOIN public.instructors i ON cs.instructor_id = i.id WHERE cs.id = NEW.session_id)
      ),
      10 -- Base points for class attendance
    WHERE NEW.member_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for class bookings
CREATE TRIGGER log_class_attendance_trigger
AFTER UPDATE ON public.class_bookings
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_class_attendance();

-- Function to log spa services
CREATE OR REPLACE FUNCTION public.log_spa_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log when spa appointment is checked in
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.member_activities (
      member_id,
      activity_type,
      activity_data,
      points_earned
    )
    VALUES (
      NEW.member_id,
      'spa_service',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'service_id', NEW.service_id,
        'appointment_date', NEW.appointment_date,
        'price', NEW.price,
        'member_price', NEW.member_price
      ),
      5 -- Points for spa service
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for spa appointments
CREATE TRIGGER log_spa_service_trigger
AFTER UPDATE ON public.spa_appointments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_spa_service();

-- Function to log check-ins
CREATE OR REPLACE FUNCTION public.log_check_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.member_activities (
    member_id,
    activity_type,
    activity_data,
    points_earned
  )
  VALUES (
    NEW.member_id,
    'check_in',
    jsonb_build_object(
      'check_in_id', NEW.id,
      'checked_in_at', NEW.checked_in_at
    ),
    2 -- Points for check-in
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for check-ins
CREATE TRIGGER log_check_in_trigger
AFTER INSERT ON public.check_ins
FOR EACH ROW
EXECUTE FUNCTION public.log_check_in();

-- Function to log cafe orders
CREATE OR REPLACE FUNCTION public.log_cafe_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log when cafe order is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.member_activities (
      member_id,
      activity_type,
      activity_data,
      points_earned
    )
    VALUES (
      NEW.member_id,
      'cafe_order',
      jsonb_build_object(
        'order_id', NEW.id,
        'total_amount', NEW.total_amount,
        'item_count', jsonb_array_length(NEW.order_items),
        'completed_at', NEW.completed_at
      ),
      1 -- Points for cafe order
    )
    WHERE NEW.member_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for cafe orders
CREATE TRIGGER log_cafe_order_trigger
AFTER UPDATE ON public.cafe_orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_cafe_order();

-- Function to log kids care bookings
CREATE OR REPLACE FUNCTION public.log_kids_care_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log when kids care booking is checked in
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.member_activities (
      member_id,
      activity_type,
      activity_data,
      points_earned
    )
    VALUES (
      NEW.member_id,
      'kids_care_booking',
      jsonb_build_object(
        'booking_id', NEW.id,
        'child_name', NEW.child_name,
        'booking_date', NEW.booking_date,
        'duration_hours', EXTRACT(EPOCH FROM (NEW.end_time::time - NEW.start_time::time)) / 3600
      ),
      3 -- Points for kids care booking
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for kids care bookings
CREATE TRIGGER log_kids_care_booking_trigger
AFTER UPDATE ON public.kids_care_bookings
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_kids_care_booking();



