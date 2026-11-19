-- Rolled-back check of Black Friday plan session release (80-pack, member plan).
-- Expected: after sale 12 available / 68 on hold; failed payment adds nothing;
-- a repeated paid notice adds once (24/56); all paid = 80/0; use-by date unchanged.
DO $$
DECLARE k text := 'test-rollback-' || gen_random_uuid(); u uuid; p uuid; r jsonb; pass record; i1 uuid; out text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SELECT user_id INTO u FROM members WHERE status='active' AND user_id IS NOT NULL LIMIT 1;
  PERFORM pt_open_sale_intent_v2(k, u, '3db046fb-7780-4651-84f0-cc0186e4a4d7', 1, 'payment_plan', current_date, current_date + 279, NULL, NULL, NULL, 'TEST', 'payment_plan', 7, 48000, current_date + 30, 48000, '3070140d-dcf9-43ff-87ed-57f2a0f6ec7b');
  PERFORM pt_attach_plan_schedule(k, current_date + 30);
  PERFORM pt_record_sale_payment(k, 'pi_test_' || k, 48000);
  r := pt_finalize_package_sale(k, NULL);
  p := (r->'pass_ids'->>0)::uuid;
  PERFORM pt_materialize_plan_installments(k, 'sub_test_' || k);
  PERFORM pt_plan_apply_session_hold(k);
  PERFORM pt_plan_apply_session_hold(k);
  SELECT sessions_remaining, sessions_on_hold, expires_at INTO pass FROM pt_passes WHERE id=p;
  out := out || format('after sale: avail=%s hold=%s expires=%s; ', pass.sessions_remaining, pass.sessions_on_hold, pass.expires_at);
  SELECT id INTO i1 FROM pt_payment_plan_installments WHERE pass_id=p AND installment_number=1;
  UPDATE pt_payment_plan_installments SET status='failed' WHERE id=i1;
  SELECT sessions_remaining, sessions_on_hold INTO pass FROM pt_passes WHERE id=p;
  out := out || format('after failed: avail=%s hold=%s; ', pass.sessions_remaining, pass.sessions_on_hold);
  UPDATE pt_payment_plan_installments SET status='paid' WHERE id=i1;
  UPDATE pt_payment_plan_installments SET status='paid' WHERE id=i1;
  SELECT sessions_remaining, sessions_on_hold INTO pass FROM pt_passes WHERE id=p;
  out := out || format('after paid x2: avail=%s hold=%s; ', pass.sessions_remaining, pass.sessions_on_hold);
  UPDATE pt_payment_plan_installments SET status='paid' WHERE pass_id=p AND installment_number>1;
  SELECT sessions_remaining, sessions_on_hold INTO pass FROM pt_passes WHERE id=p;
  out := out || format('all paid: avail=%s hold=%s', pass.sessions_remaining, pass.sessions_on_hold);
  RAISE EXCEPTION 'ROLLBACK_RESULT %', out;
END $$;
