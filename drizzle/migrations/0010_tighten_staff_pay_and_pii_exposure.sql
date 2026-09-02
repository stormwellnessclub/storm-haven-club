-- 1) instructors: hide pay rates from non-financial staff (front_desk) in the staff RPC
CREATE OR REPLACE FUNCTION public.get_instructors_with_contact()
RETURNS SETOF public.instructors
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role])
      THEN i
    ELSE jsonb_populate_record(
           NULL::public.instructors,
           to_jsonb(i) || jsonb_build_object(
             'hourly_rate', NULL,
             'default_per_class_rate', NULL,
             'pay_type', NULL
           ))
  END
  FROM public.instructors i
  WHERE has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
$function$;

-- 2) spa_therapists: remove table-wide SELECT so column grants (which exclude
--    hourly_rate/email/phone) govern direct API reads; staff use the RPC.
REVOKE SELECT ON public.spa_therapists FROM authenticated;
GRANT SELECT (id, full_name, bio, specialties, photo_url, is_active, created_at, updated_at)
  ON public.spa_therapists TO authenticated;

CREATE OR REPLACE FUNCTION public.get_spa_therapists_with_contact()
RETURNS SETOF public.spa_therapists
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role])
      THEN t
    ELSE jsonb_populate_record(
           NULL::public.spa_therapists,
           to_jsonb(t) || jsonb_build_object('hourly_rate', NULL))
  END
  FROM public.spa_therapists t
  WHERE has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]);
$function$;

-- 3) kids_care_children: restrict direct reads of medical data to admins only.
DROP POLICY IF EXISTS "Staff can view all children" ON public.kids_care_children;
CREATE POLICY "Admins can view all children"
  ON public.kids_care_children
  FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- 4) guest_passes: drop unnecessary anon read grant and hide card expiry /
--    feedback token from client reads (POS still sees brand + last4).
REVOKE SELECT ON public.guest_passes FROM anon;
REVOKE SELECT ON public.guest_passes FROM authenticated;
GRANT SELECT (
  id, guest_name, guest_email, price_paid, status, purchased_at, expires_at, used_at,
  sold_by, stripe_payment_id, created_at, user_id, valid_date, phone_number,
  member_referral, visit_interests, visit_notes, add_ons, stripe_customer_id,
  guest_gender, admin_notes, checked_in_by, no_show, feedback_email_sent_at,
  follow_up_status, follow_up_notes, card_brand, card_last4, referring_member_id,
  payment_method
) ON public.guest_passes TO authenticated;