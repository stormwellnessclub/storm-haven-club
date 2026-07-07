DROP POLICY IF EXISTS "Users can review their own past bookings" ON public.class_reviews;

CREATE POLICY "Users can review their own past bookings"
  ON public.class_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.class_bookings cb
      JOIN public.class_sessions cs ON cs.id = cb.session_id
      WHERE cb.id = class_reviews.booking_id
        AND cb.user_id = auth.uid()
        AND cb.status IN ('confirmed'::booking_status, 'completed'::booking_status)
        AND (
          ((cs.session_date::timestamp + cs.end_time) AT TIME ZONE 'America/Chicago')
          <= NOW()
        )
    )
  );