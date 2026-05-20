
-- ============================================
-- Cafe Credit System
-- ============================================

-- 1. Ledger (append-only audit)
CREATE TABLE public.cafe_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'cash_grant', 'cash_purchase', 'item_grant',
    'redemption_cash', 'redemption_item', 'adjustment'
  )),
  amount_cents integer NOT NULL DEFAULT 0,
  item_quantity integer NOT NULL DEFAULT 0,
  menu_item_id uuid REFERENCES public.cafe_menu_items(id) ON DELETE SET NULL,
  menu_item_name text,
  cafe_order_id uuid REFERENCES public.cafe_orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cafe_credit_ledger_member ON public.cafe_credit_ledger(member_id, created_at DESC);
CREATE INDEX idx_cafe_credit_ledger_order ON public.cafe_credit_ledger(cafe_order_id);

ALTER TABLE public.cafe_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own ledger" ON public.cafe_credit_ledger
  FOR SELECT TO authenticated USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff manage all ledger" ON public.cafe_credit_ledger
  FOR ALL TO authenticated USING (
    has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[])
  ) WITH CHECK (
    has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[])
  );

-- 2. Prepaid items (current count)
CREATE TABLE public.cafe_prepaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.cafe_menu_items(id) ON DELETE CASCADE,
  quantity_remaining integer NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, menu_item_id)
);

CREATE INDEX idx_cafe_prepaid_items_member ON public.cafe_prepaid_items(member_id);

ALTER TABLE public.cafe_prepaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own prepaid" ON public.cafe_prepaid_items
  FOR SELECT TO authenticated USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff manage prepaid" ON public.cafe_prepaid_items
  FOR ALL TO authenticated USING (
    has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[])
  ) WITH CHECK (
    has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[])
  );

-- ============================================
-- RPCs
-- ============================================

-- Balance + prepaid summary
CREATE OR REPLACE FUNCTION public.get_member_cafe_credit_balance(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance bigint;
  v_items jsonb;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
  FROM cafe_credit_ledger WHERE member_id = _member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id', p.menu_item_id,
    'quantity_remaining', p.quantity_remaining,
    'item_name', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m.brand_name, m.item_name, m.flavor)), ''), 'Item'),
    'price', m.price
  )) FILTER (WHERE p.quantity_remaining > 0), '[]'::jsonb) INTO v_items
  FROM cafe_prepaid_items p
  LEFT JOIN cafe_menu_items m ON m.id = p.menu_item_id
  WHERE p.member_id = _member_id;

  RETURN jsonb_build_object(
    'balance_cents', v_balance,
    'prepaid_items', v_items
  );
END $$;

-- Grant cash credit (free)
CREATE OR REPLACE FUNCTION public.grant_cafe_cash_credit(
  _member_id uuid, _amount_cents integer, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO cafe_credit_ledger(member_id, kind, amount_cents, reason, created_by)
  VALUES (_member_id, 'cash_grant', _amount_cents, _reason, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Record cash purchase (card-funded top-up)
CREATE OR REPLACE FUNCTION public.record_cafe_cash_purchase(
  _member_id uuid, _amount_cents integer, _payment_intent_id text, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO cafe_credit_ledger(member_id, kind, amount_cents, reason, stripe_payment_intent_id, created_by)
  VALUES (_member_id, 'cash_purchase', _amount_cents, _reason, _payment_intent_id, auth.uid())
  ON CONFLICT (stripe_payment_intent_id) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Grant prepaid items
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
END $$;

-- Manual adjustment (super-admin)
CREATE OR REPLACE FUNCTION public.adjust_cafe_credit(
  _member_id uuid, _amount_cents integer, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Only super admins may adjust';
  END IF;
  IF _reason IS NULL OR LENGTH(TRIM(_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;

  INSERT INTO cafe_credit_ledger(member_id, kind, amount_cents, reason, created_by)
  VALUES (_member_id, 'adjustment', _amount_cents, _reason, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Atomic redemption
-- _cart_items: jsonb array of { menu_item_id (uuid|null), quantity (int), unit_price_cents (int), name }
-- _cash_to_apply_cents: how much cash credit to apply on the post-prepaid remaining order total
-- Returns: { item_discount_cents, cash_applied_cents, remaining_balance_cents, ledger_ids }
CREATE OR REPLACE FUNCTION public.redeem_cafe_credit(
  _member_id uuid,
  _cafe_order_id uuid,
  _cart_items jsonb,
  _cash_to_apply_cents integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_menu_id uuid;
  v_qty int;
  v_unit_cents int;
  v_use_qty int;
  v_remaining int;
  v_item_discount int := 0;
  v_balance bigint;
  v_cash_applied int := 0;
  v_ledger_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_name text;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Lock prepaid rows for this member
  PERFORM 1 FROM cafe_prepaid_items WHERE member_id = _member_id FOR UPDATE;

  -- Walk cart items, deduct prepaid
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_cart_items, '[]'::jsonb))
  LOOP
    v_menu_id := NULLIF(v_item->>'menu_item_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_unit_cents := COALESCE((v_item->>'unit_price_cents')::int, 0);
    v_name := COALESCE(v_item->>'name', 'Item');
    IF v_menu_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT quantity_remaining INTO v_remaining
    FROM cafe_prepaid_items
    WHERE member_id = _member_id AND menu_item_id = v_menu_id;

    IF v_remaining IS NULL OR v_remaining = 0 THEN CONTINUE; END IF;

    v_use_qty := LEAST(v_remaining, v_qty);

    UPDATE cafe_prepaid_items
      SET quantity_remaining = quantity_remaining - v_use_qty, updated_at = now()
      WHERE member_id = _member_id AND menu_item_id = v_menu_id;

    v_item_discount := v_item_discount + (v_use_qty * v_unit_cents);

    INSERT INTO cafe_credit_ledger(
      member_id, kind, item_quantity, menu_item_id, menu_item_name,
      amount_cents, cafe_order_id, reason, created_by
    ) VALUES (
      _member_id, 'redemption_item', -v_use_qty, v_menu_id, v_name,
      -(v_use_qty * v_unit_cents), _cafe_order_id,
      'Prepaid item redemption', auth.uid()
    ) RETURNING id INTO v_id;
    v_ledger_ids := v_ledger_ids || v_id;
  END LOOP;

  -- Apply cash credit
  IF _cash_to_apply_cents > 0 THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
    FROM cafe_credit_ledger WHERE member_id = _member_id;

    v_cash_applied := LEAST(_cash_to_apply_cents, GREATEST(v_balance, 0)::int);

    IF v_cash_applied > 0 THEN
      INSERT INTO cafe_credit_ledger(
        member_id, kind, amount_cents, cafe_order_id, reason, created_by
      ) VALUES (
        _member_id, 'redemption_cash', -v_cash_applied, _cafe_order_id,
        'Cash credit applied', auth.uid()
      ) RETURNING id INTO v_id;
      v_ledger_ids := v_ledger_ids || v_id;
    END IF;
  END IF;

  -- Final balance
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
  FROM cafe_credit_ledger WHERE member_id = _member_id;

  RETURN jsonb_build_object(
    'item_discount_cents', v_item_discount,
    'cash_applied_cents', v_cash_applied,
    'remaining_balance_cents', v_balance,
    'ledger_ids', to_jsonb(v_ledger_ids)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_member_cafe_credit_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_cafe_cash_credit(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cafe_cash_purchase(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_cafe_prepaid_items(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_cafe_credit(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_cafe_credit(uuid, uuid, jsonb, integer) TO authenticated;
