-- =====================================================
-- PHASE 1: CLASS SYSTEM DATABASE FOUNDATION
-- =====================================================

-- Create enum for class categories
CREATE TYPE public.class_category AS ENUM ('pilates_cycling', 'other');

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled', 'no_show', 'completed');

-- Create enum for waitlist status
CREATE TYPE public.waitlist_status AS ENUM ('waiting', 'notified', 'claimed', 'expired', 'cancelled');

-- Create enum for pass status
CREATE TYPE public.pass_status AS ENUM ('active', 'expired', 'exhausted');

-- =====================================================
-- TABLE: class_types
-- =====================================================
CREATE TABLE public.class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category class_category NOT NULL DEFAULT 'other',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_capacity INTEGER NOT NULL DEFAULT 20,
  is_heated BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active class types"
ON public.class_types FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage class types"
ON public.class_types FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: instructors
-- =====================================================
CREATE TABLE public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  photo_url TEXT,
  specialties TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active instructors"
ON public.instructors FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage instructors"
ON public.instructors FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_schedules (recurring schedule templates)
-- =====================================================
CREATE TABLE public.class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  max_capacity INTEGER, -- Override class_type default if set
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active schedules"
ON public.class_schedules FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage schedules"
ON public.class_schedules FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_sessions (actual class instances)
-- =====================================================
CREATE TABLE public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.class_schedules(id) ON DELETE SET NULL,
  class_type_id UUID NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  max_capacity INTEGER NOT NULL,
  current_enrollment INTEGER NOT NULL DEFAULT 0,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_type_id, session_date, start_time)
);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view class sessions"
ON public.class_sessions FOR SELECT
USING (true);

CREATE POLICY "Staff can manage class sessions"
ON public.class_sessions FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_bookings
-- =====================================================
CREATE TABLE public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  payment_method TEXT, -- 'credit', 'pass', 'single_purchase'
  pass_id UUID, -- References class_passes if used
  credits_used INTEGER DEFAULT 0,
  amount_paid DECIMAL(10,2),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings"
ON public.class_bookings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings"
ON public.class_bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
ON public.class_bookings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all bookings"
ON public.class_bookings FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage all bookings"
ON public.class_bookings FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_waitlist
-- =====================================================
CREATE TABLE public.class_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE public.class_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist entries"
ON public.class_waitlist FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can join waitlist"
ON public.class_waitlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own waitlist entries"
ON public.class_waitlist FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove themselves from waitlist"
ON public.class_waitlist FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all waitlist entries"
ON public.class_waitlist FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage waitlist"
ON public.class_waitlist FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_credits (Diamond member monthly credits)
-- =====================================================
CREATE TABLE public.class_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  credits_total INTEGER NOT NULL DEFAULT 10,
  credits_remaining INTEGER NOT NULL DEFAULT 10,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, month_year)
);

ALTER TABLE public.class_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
ON public.class_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all credits"
ON public.class_credits FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage credits"
ON public.class_credits FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_passes (purchased class packs)
-- =====================================================
CREATE TABLE public.class_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  pass_type TEXT NOT NULL, -- 'single', '5_pack', '10_pack'
  category class_category NOT NULL,
  classes_total INTEGER NOT NULL,
  classes_remaining INTEGER NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  is_member_price BOOLEAN NOT NULL DEFAULT false,
  status pass_status NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- 2 months from purchase
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.class_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own passes"
ON public.class_passes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can purchase passes"
ON public.class_passes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all passes"
ON public.class_passes FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage passes"
ON public.class_passes FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- =====================================================
-- TABLE: class_pricing (store pricing configuration)
-- =====================================================
CREATE TABLE public.class_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category class_category NOT NULL,
  pass_type TEXT NOT NULL, -- 'single', '5_pack', '10_pack'
  member_price DECIMAL(10,2) NOT NULL,
  non_member_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, pass_type)
);

ALTER TABLE public.class_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing"
ON public.class_pricing FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage pricing"
ON public.class_pricing FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- =====================================================
-- TRIGGERS: Updated_at timestamps
-- =====================================================
CREATE TRIGGER update_class_types_updated_at
  BEFORE UPDATE ON public.class_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_bookings_updated_at
  BEFORE UPDATE ON public.class_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_waitlist_updated_at
  BEFORE UPDATE ON public.class_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_credits_updated_at
  BEFORE UPDATE ON public.class_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_passes_updated_at
  BEFORE UPDATE ON public.class_passes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_pricing_updated_at
  BEFORE UPDATE ON public.class_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: Update session enrollment count
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_session_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE public.class_sessions 
    SET current_enrollment = current_enrollment + 1
    WHERE id = NEW.session_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
      UPDATE public.class_sessions 
      SET current_enrollment = current_enrollment - 1
      WHERE id = NEW.session_id;
    ELSIF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE public.class_sessions 
      SET current_enrollment = current_enrollment + 1
      WHERE id = NEW.session_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE public.class_sessions 
    SET current_enrollment = current_enrollment - 1
    WHERE id = OLD.session_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_enrollment_on_booking
  AFTER INSERT OR UPDATE OR DELETE ON public.class_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_session_enrollment();

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX idx_class_sessions_date ON public.class_sessions(session_date);
CREATE INDEX idx_class_sessions_class_type ON public.class_sessions(class_type_id);
CREATE INDEX idx_class_bookings_session ON public.class_bookings(session_id);
CREATE INDEX idx_class_bookings_user ON public.class_bookings(user_id);
CREATE INDEX idx_class_waitlist_session ON public.class_waitlist(session_id);
CREATE INDEX idx_class_passes_user ON public.class_passes(user_id);
CREATE INDEX idx_class_credits_user ON public.class_credits(user_id);