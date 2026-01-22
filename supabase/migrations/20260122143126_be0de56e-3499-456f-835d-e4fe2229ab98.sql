-- =====================================================
-- Migration 2: spa_appointments table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.spa_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  service_price DECIMAL(10,2) NOT NULL,
  member_price DECIMAL(10,2),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  cleanup_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'confirmed',
  staff_id UUID,
  staff_notes TEXT,
  member_notes TEXT,
  payment_method TEXT,
  payment_intent_id TEXT,
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.spa_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spa appointments"
ON public.spa_appointments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own spa appointments"
ON public.spa_appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spa appointments"
ON public.spa_appointments FOR UPDATE
USING (auth.uid() = user_id AND status IN ('confirmed', 'pending'));

CREATE POLICY "Staff can view all spa appointments"
ON public.spa_appointments FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]));

CREATE POLICY "Staff can manage all spa appointments"
ON public.spa_appointments FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]));

CREATE TRIGGER update_spa_appointments_updated_at
  BEFORE UPDATE ON public.spa_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_spa_appointments_user_id ON public.spa_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_member_id ON public.spa_appointments(member_id);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_date_time ON public.spa_appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_status ON public.spa_appointments(status);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_staff_id ON public.spa_appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_created_at ON public.spa_appointments(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spa_appointments_unique_booking 
ON public.spa_appointments(appointment_date, appointment_time, staff_id)
WHERE status IN ('confirmed', 'pending') AND staff_id IS NOT NULL;

COMMENT ON TABLE public.spa_appointments IS 'Stores spa service appointments with member discounts and staff assignment.';