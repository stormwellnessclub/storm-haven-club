
ALTER TABLE public.event_tickets
  ADD COLUMN IF NOT EXISTS attendee_first_name text,
  ADD COLUMN IF NOT EXISTS attendee_last_name text,
  ADD COLUMN IF NOT EXISTS attendee_email text,
  ADD COLUMN IF NOT EXISTS attendee_phone text,
  ADD COLUMN IF NOT EXISTS is_gift boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gifted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_tickets_attendee_email_idx
  ON public.event_tickets (lower(attendee_email));
