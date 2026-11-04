-- Members can no longer read kids_care_hour_slots directly (they use an RPC),
-- so the booking time check must run with owner rights or it always fails for members.
ALTER FUNCTION public.validate_kids_care_booking_slot() SECURITY DEFINER;
ALTER FUNCTION public.validate_kids_care_booking_slot() SET search_path = public;