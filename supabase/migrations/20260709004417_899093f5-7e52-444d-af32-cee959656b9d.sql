CREATE OR REPLACE FUNCTION public.submit_class_review_for_booking(
  _booking_id uuid,
  _rating integer,
  _review_text text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _uid uuid := auth.uid();
  _booking record;
  _end_ts timestamptz;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to leave a review.';
  END IF;

  IF _booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking is missing.';
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.';
  END IF;

  SELECT
    cb.id,
    cb.user_id,
    cb.status,
    cb.session_id,
    cs.class_type_id,
    cs.session_date,
    cs.end_time,
    cs.is_cancelled
  INTO _booking
  FROM public.class_bookings cb
  JOIN public.class_sessions cs ON cs.id = cb.session_id
  WHERE cb.id = _booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF _booking.user_id IS NULL OR _booking.user_id <> _uid THEN
    RAISE EXCEPTION 'You can only review your own bookings.';
  END IF;

  IF _booking.status NOT IN ('confirmed'::booking_status, 'completed'::booking_status, 'no_show'::booking_status) THEN
    RAISE EXCEPTION 'This booking is not eligible for a review.';
  END IF;

  IF COALESCE(_booking.is_cancelled, false) THEN
    RAISE EXCEPTION 'Cancelled classes cannot be reviewed.';
  END IF;

  _end_ts := ((_booking.session_date::timestamp + _booking.end_time::interval) AT TIME ZONE 'America/Chicago');
  IF _end_ts > now() THEN
    RAISE EXCEPTION 'You can leave a review after the class ends.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.class_reviews WHERE booking_id = _booking_id) THEN
    RAISE EXCEPTION 'You already reviewed this class.';
  END IF;

  INSERT INTO public.class_reviews (user_id, booking_id, class_type_id, session_id, rating, review_text)
  VALUES (
    _uid,
    _booking.id,
    _booking.class_type_id,
    _booking.session_id,
    _rating,
    NULLIF(trim(COALESCE(_review_text, '')), '')
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_class_review_for_booking(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_class_review_for_booking(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_class_review_for_booking(uuid, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';