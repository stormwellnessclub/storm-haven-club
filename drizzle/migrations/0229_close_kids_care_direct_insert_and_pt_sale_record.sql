-- Security audit follow-up (Nov 22 2026).

-- 1) Kids care: members now book through member_book_kids_care (0206_member_kids_care_booking_rpcs), which
--    checks the pass and takes the visit off in one step. The old "create
--    their own" insert policies still let a member insert a booking directly,
--    skipping the visit deduction. Staff keep their manage policies.
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.kids_care_bookings;
DROP POLICY IF EXISTS "Users can create their own kids care bookings" ON public.kids_care_bookings;

-- 2) pt_sale_payment_record had no caller check and was callable with the
--    public key. Only pt_finalize_package_sale (SECURITY DEFINER) calls it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pt_sale_payment_record'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
