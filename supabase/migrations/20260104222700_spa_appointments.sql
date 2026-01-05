-- =====================================================
-- TABLE: spa_appointments
-- =====================================================
CREATE TABLE public.spa_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id INTEGER NOT NULL, -- References the service ID from Spa.tsx service list
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL, -- 'Body Rituals', 'Body Wraps', 'Massage', 'Facials', 'Recovery'
  service_price DECIMAL(10,2) NOT NULL,
  member_price DECIMAL(10,2), -- Discounted price for members
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  cleanup_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'completed', 'cancelled', 'no_show'
  staff_id UUID, -- Optional: reference to staff/instructor table if tracking specific therapist
  staff_notes TEXT, -- Internal notes for staff
  member_notes TEXT, -- Notes from member (preferences, concerns, etc.)
  payment_method TEXT, -- 'card', 'member_account', 'credits' (if using spa credits)
  payment_intent_id TEXT,
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.spa_appointments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own appointments
CREATE POLICY "Users can view their own appointments"
ON public.spa_appointments FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Users can create their own appointments
CREATE POLICY "Users can create their own appointments"
ON public.spa_appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own appointments (before appointment time)
CREATE POLICY "Users can update their own appointments"
ON public.spa_appointments FOR UPDATE
USING (auth.uid() = user_id AND status IN ('confirmed', 'pending'));

-- RLS: Staff can view all appointments
CREATE POLICY "Staff can view all appointments"
ON public.spa_appointments FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]));

-- RLS: Staff can manage all appointments
CREATE POLICY "Staff can manage all appointments"
ON public.spa_appointments FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]));

-- Create trigger for updated_at
CREATE TRIGGER update_spa_appointments_updated_at
  BEFORE UPDATE ON public.spa_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster queries
CREATE INDEX idx_spa_appointments_user_id ON public.spa_appointments(user_id);
CREATE INDEX idx_spa_appointments_member_id ON public.spa_appointments(member_id);
CREATE INDEX idx_spa_appointments_date_time ON public.spa_appointments(appointment_date, appointment_time);
CREATE INDEX idx_spa_appointments_status ON public.spa_appointments(status);
CREATE INDEX idx_spa_appointments_staff_id ON public.spa_appointments(staff_id);
CREATE INDEX idx_spa_appointments_created_at ON public.spa_appointments(created_at DESC);

-- Add constraint to prevent double-booking (same time slot + staff if specified)
-- Note: This allows overlapping appointments if staff_id is NULL (multiple therapists available)
CREATE UNIQUE INDEX idx_spa_appointments_unique_booking 
ON public.spa_appointments(appointment_date, appointment_time, staff_id)
WHERE status IN ('confirmed', 'pending') AND staff_id IS NOT NULL;

-- Add comment
COMMENT ON TABLE public.spa_appointments IS 'Stores spa service appointments. Supports member discounts and staff assignment.';



