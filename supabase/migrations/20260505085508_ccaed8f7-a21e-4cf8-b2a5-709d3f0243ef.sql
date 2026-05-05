ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS is_admin_hold boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_class_bookings_admin_hold
  ON public.class_bookings (session_id)
  WHERE is_admin_hold = true;