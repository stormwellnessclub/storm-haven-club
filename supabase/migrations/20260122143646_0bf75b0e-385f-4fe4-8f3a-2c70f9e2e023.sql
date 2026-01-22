-- Fix the trigger functions with correct syntax

-- Function to log spa services (fixed)
CREATE OR REPLACE FUNCTION public.log_spa_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.member_id IS NOT NULL THEN
    INSERT INTO public.member_activities (
      member_id, activity_type, activity_data, points_earned
    )
    VALUES (
      NEW.member_id,
      'spa_service',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'service_id', NEW.service_id,
        'service_name', NEW.service_name,
        'appointment_date', NEW.appointment_date,
        'service_price', NEW.service_price,
        'member_price', NEW.member_price
      ),
      5
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for spa appointments
DROP TRIGGER IF EXISTS log_spa_service_trigger ON public.spa_appointments;
CREATE TRIGGER log_spa_service_trigger
AFTER UPDATE ON public.spa_appointments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_spa_service();

-- Function to log cafe orders (fixed)
CREATE OR REPLACE FUNCTION public.log_cafe_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.member_id IS NOT NULL THEN
    INSERT INTO public.member_activities (
      member_id, activity_type, activity_data, points_earned
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
      1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for cafe orders
DROP TRIGGER IF EXISTS log_cafe_order_trigger ON public.cafe_orders;
CREATE TRIGGER log_cafe_order_trigger
AFTER UPDATE ON public.cafe_orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION public.log_cafe_order();