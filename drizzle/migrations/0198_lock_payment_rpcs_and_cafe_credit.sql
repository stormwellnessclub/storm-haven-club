-- Security pass (Nov 21 2026): close findings the 0197 pass left open.

-- 1) Payment bookkeeping functions had no caller check and were callable by
--    anyone with the public key (e.g. mark a PT installment paid, clear dues).
--    Only server code (service role) and other database functions call them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'pt_record_installment_payment',
        'pt_register_failed_installment',
        'pt_reconcile_installment',
        'pt_attach_plan_schedule',
        'pt_recalc_invoice',
        'recalc_event_invoice',
        'settle_membership_dues_payment'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 2) Café credit: staff could write the credit tables directly, skipping the
--    "not your own account" check in grant_cafe_cash_credit. Staff keep read
--    access; every write goes through the checked functions or the webhook.
DROP POLICY IF EXISTS "Staff manage all ledger" ON public.cafe_credit_ledger;
DROP POLICY IF EXISTS "Staff view all ledger" ON public.cafe_credit_ledger;
CREATE POLICY "Staff view all ledger" ON public.cafe_credit_ledger
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]));

DROP POLICY IF EXISTS "Staff manage prepaid" ON public.cafe_prepaid_items;
DROP POLICY IF EXISTS "Staff view prepaid" ON public.cafe_prepaid_items;
CREATE POLICY "Staff view prepaid" ON public.cafe_prepaid_items
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]));

-- 3) Prepaid café items: same self-grant guard as café cash credit.
CREATE OR REPLACE FUNCTION public.grant_cafe_prepaid_items(
  _member_id uuid, _menu_item_id uuid, _quantity integer, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF EXISTS (SELECT 1 FROM public.members m WHERE m.id = _member_id AND m.user_id = auth.uid())
     AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'You cannot add café items to your own account';
  END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', brand_name, item_name, flavor)), ''), 'Item')
    INTO v_name FROM cafe_menu_items WHERE id = _menu_item_id;

  INSERT INTO cafe_prepaid_items(member_id, menu_item_id, quantity_remaining, updated_at)
  VALUES (_member_id, _menu_item_id, _quantity, now())
  ON CONFLICT (member_id, menu_item_id) DO UPDATE
    SET quantity_remaining = cafe_prepaid_items.quantity_remaining + EXCLUDED.quantity_remaining,
        updated_at = now();

  INSERT INTO cafe_credit_ledger(member_id, kind, item_quantity, menu_item_id, menu_item_name, reason, created_by)
  VALUES (_member_id, 'item_grant', _quantity, _menu_item_id, v_name, _reason, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.grant_cafe_prepaid_items(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_cafe_prepaid_items(uuid, uuid, integer, text) TO authenticated, service_role;
