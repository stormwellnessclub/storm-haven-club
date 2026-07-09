
-- Widen INSERT policy to include no_show
DROP POLICY IF EXISTS "Users can review their own past bookings" ON public.class_reviews;
CREATE POLICY "Users can review their own past bookings"
ON public.class_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM class_bookings cb
    JOIN class_sessions cs ON cs.id = cb.session_id
    WHERE cb.id = class_reviews.booking_id
      AND cb.user_id = auth.uid()
      AND cb.status = ANY (ARRAY['confirmed'::booking_status, 'completed'::booking_status, 'no_show'::booking_status])
      AND (((cs.session_date)::timestamp without time zone + (cs.end_time)::interval) AT TIME ZONE 'America/Chicago') <= now()
  )
);

-- SECURITY DEFINER RPC with clear errors
CREATE OR REPLACE FUNCTION public.submit_class_review(
  _booking_id uuid,
  _class_type_id uuid,
  _session_id uuid,
  _rating int,
  _review_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _booking record;
  _session record;
  _end_ts timestamptz;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to leave a review.';
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.';
  END IF;

  SELECT * INTO _booking FROM class_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF _booking.user_id <> _uid THEN
    RAISE EXCEPTION 'You can only review your own bookings.';
  END IF;

  IF _booking.status NOT IN ('confirmed'::booking_status, 'completed'::booking_status, 'no_show'::booking_status) THEN
    RAISE EXCEPTION 'This booking is not eligible for a review.';
  END IF;

  SELECT * INTO _session FROM class_sessions WHERE id = _booking.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found.';
  END IF;

  _end_ts := ((_session.session_date::timestamp + _session.end_time::interval) AT TIME ZONE 'America/Chicago');
  IF _end_ts > now() THEN
    RAISE EXCEPTION 'You can leave a review after the class ends.';
  END IF;

  IF EXISTS (SELECT 1 FROM class_reviews WHERE booking_id = _booking_id) THEN
    RAISE EXCEPTION 'You already reviewed this class.';
  END IF;

  INSERT INTO class_reviews (user_id, booking_id, class_type_id, session_id, rating, review_text)
  VALUES (_uid, _booking_id, _class_type_id, _booking.session_id, _rating, NULLIF(trim(_review_text), ''))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_class_review(uuid, uuid, uuid, int, text) TO authenticated;
