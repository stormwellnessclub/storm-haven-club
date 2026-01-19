-- =============================================
-- SECURITY HARDENING: Enable RLS on unprotected tables
-- Using DROP IF EXISTS to handle existing policies
-- =============================================

-- 1. INSTRUCTORS TABLE - Add RLS Protection
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can manage instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated can view active instructors" ON public.instructors;

-- Staff can manage instructors
CREATE POLICY "Staff can manage instructors"
ON public.instructors FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Authenticated users can view active instructors (for class booking display)
CREATE POLICY "Authenticated can view active instructors"
ON public.instructors FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- 2. SCANNER SETTINGS - Restrict QR Token Access (contains qr_token_secret)
ALTER TABLE public.scanner_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage scanner settings" ON public.scanner_settings;

-- Only super_admin/admin can view/manage scanner settings
CREATE POLICY "Admins can manage scanner settings"
ON public.scanner_settings FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

-- 3. GUEST PASSES - Add RLS Protection
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can manage guest passes" ON public.guest_passes;

-- Staff can manage guest passes
CREATE POLICY "Staff can manage guest passes"
ON public.guest_passes FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- 4. CHECK-INS - Add RLS Protection
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Members can view own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can view all check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can manage check-ins" ON public.check_ins;

-- Members can view their own check-ins
CREATE POLICY "Members can view own check-ins"
ON public.check_ins FOR SELECT
USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Staff can view all check-ins
CREATE POLICY "Staff can view all check-ins"
ON public.check_ins FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- Staff can manage check-ins (insert/update/delete)
CREATE POLICY "Staff can manage check-ins"
ON public.check_ins FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- 5. SCANNER ACCESS LOGS - Add RLS Protection
ALTER TABLE public.scanner_access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can view access logs" ON public.scanner_access_logs;
DROP POLICY IF EXISTS "Staff can insert access logs" ON public.scanner_access_logs;

-- Staff can view all access logs
CREATE POLICY "Staff can view access logs"
ON public.scanner_access_logs FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- Staff can insert access logs
CREATE POLICY "Staff can insert access logs"
ON public.scanner_access_logs FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));