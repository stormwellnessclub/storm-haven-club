
-- Defense-in-depth: re-revoke sensitive column SELECTs on instructors / spa_therapists
REVOKE SELECT (email, phone) ON public.instructors FROM anon, authenticated;
REVOKE SELECT (email, phone, hourly_rate) ON public.spa_therapists FROM anon, authenticated;

-- scanner_settings: hide qr_token_secret from front_desk role
REVOKE SELECT (qr_token_secret) ON public.scanner_settings FROM anon, authenticated;
-- Re-grant secret column only to admin-tier via a SECURITY DEFINER accessor (optional);
-- The "Admins can manage scanner settings" policy still allows super_admin/admin to
-- access all columns because column REVOKE is bypassed by table owner / definer paths,
-- but for client SELECTs front-desk now sees all columns EXCEPT qr_token_secret.

-- Tighten staff schedule visibility: replace has_any_staff_role with scheduling roles
DROP POLICY IF EXISTS "Staff can view all shifts" ON public.staff_shifts;
CREATE POLICY "Scheduling staff can view shifts"
  ON public.staff_shifts
  FOR SELECT
  USING (
    public.has_any_role(
      auth.uid(),
      ARRAY['super_admin','admin','manager','front_desk']::app_role[]
    )
  );

DROP POLICY IF EXISTS "Staff can view all shift templates" ON public.staff_shift_templates;
CREATE POLICY "Scheduling staff can view shift templates"
  ON public.staff_shift_templates
  FOR SELECT
  USING (
    public.has_any_role(
      auth.uid(),
      ARRAY['super_admin','admin','manager','front_desk']::app_role[]
    )
  );
