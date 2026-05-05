ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS is_fundraiser boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fundraiser_beneficiary text,
  ADD COLUMN IF NOT EXISTS session_notes text,
  ADD COLUMN IF NOT EXISTS override_price_cents integer;

INSERT INTO public.class_sessions (
  schedule_id, class_type_id, instructor_id, session_date, start_time, end_time,
  room, max_capacity, current_enrollment, is_cancelled, is_hidden,
  is_fundraiser, fundraiser_beneficiary, session_notes, override_price_cents
) VALUES
  (NULL, '8d29b6d1-1b37-4bca-aa7d-13aca36b8059', '284f1cc6-d989-4d63-8825-6b8cfa9e2987',
   '2026-05-12', '11:00:00', '11:50:00',
   'Reformer Studio', 8, 0, false, false,
   true, 'Iraqi Children Foundation',
   '100% of proceeds will be donated to the Iraqi Children Foundation.', 4000),
  (NULL, '8d29b6d1-1b37-4bca-aa7d-13aca36b8059', '284f1cc6-d989-4d63-8825-6b8cfa9e2987',
   '2026-05-12', '12:00:00', '12:50:00',
   'Reformer Studio', 8, 0, false, false,
   true, 'Iraqi Children Foundation',
   '100% of proceeds will be donated to the Iraqi Children Foundation.', 4000);