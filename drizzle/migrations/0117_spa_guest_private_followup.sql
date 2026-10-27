ALTER TABLE public.spa_guest_checkouts ADD COLUMN email_access_hash text;
CREATE OR REPLACE FUNCTION public.staff_spa_guest_waiver(p_appointment_id uuid) RETURNS TABLE(waiver_name text,waiver_signed_at timestamptz,waiver_agreement_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.waiver_name,c.waiver_signed_at,c.waiver_agreement_id FROM public.spa_guest_checkouts c
 WHERE c.appointment_id=p_appointment_id AND public.has_any_role(auth.uid(),ARRAY['super_admin','admin','manager','front_desk','spa_staff']::public.app_role[])
$$;
REVOKE ALL ON FUNCTION public.staff_spa_guest_waiver(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_spa_guest_waiver(uuid) TO authenticated;