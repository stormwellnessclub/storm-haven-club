
-- Add walk-in contact fields to class_bookings so every booking has full contact info
ALTER TABLE public.class_bookings 
  ADD COLUMN IF NOT EXISTS walk_in_email text,
  ADD COLUMN IF NOT EXISTS walk_in_phone text,
  ADD COLUMN IF NOT EXISTS pending_import_id uuid REFERENCES public.pending_non_member_imports(id);
