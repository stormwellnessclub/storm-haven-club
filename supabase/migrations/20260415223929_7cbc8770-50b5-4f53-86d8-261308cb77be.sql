ALTER TABLE public.spa_appointments
  ADD CONSTRAINT spa_appointments_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.spa_therapists(id)
  ON DELETE SET NULL;