
-- Gift cards
CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0),
  purchaser_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  purchaser_user_id UUID,
  purchaser_name TEXT,
  purchaser_email TEXT,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  custom_message TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card_on_file','cash','clover','external')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','void')),
  issued_by UUID,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_cards_recipient_email ON public.gift_cards (LOWER(recipient_email));
CREATE INDEX idx_gift_cards_purchaser_member ON public.gift_cards (purchaser_member_id);
CREATE INDEX idx_gift_cards_status ON public.gift_cards (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access gift_cards"
  ON public.gift_cards FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk']::app_role[]));

CREATE POLICY "Members can view own gift_cards"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (
    purchaser_user_id = auth.uid()
    OR LOWER(recipient_email) = public.current_user_email_lower()
  );

CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Redemptions
CREATE TABLE public.gift_card_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  balance_after_cents INTEGER NOT NULL CHECK (balance_after_cents >= 0),
  applied_to_type TEXT,
  applied_to_id UUID,
  redeemed_by_user_id UUID,
  redeemed_by_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_card_redemptions_card ON public.gift_card_redemptions (gift_card_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_redemptions TO authenticated;
GRANT ALL ON public.gift_card_redemptions TO service_role;

ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access gift_card_redemptions"
  ON public.gift_card_redemptions FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk']::app_role[]));

CREATE POLICY "Members can view own gift_card_redemptions"
  ON public.gift_card_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gift_cards gc
      WHERE gc.id = gift_card_redemptions.gift_card_id
        AND (gc.purchaser_user_id = auth.uid()
             OR LOWER(gc.recipient_email) = public.current_user_email_lower())
    )
  );

-- Code generator
CREATE OR REPLACE FUNCTION public.generate_gift_card_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_exists BOOLEAN;
  v_i INT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_code := 'STORM-';
    FOR v_i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    v_code := v_code || '-';
    FOR v_i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.gift_cards WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique gift card code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_gift_card_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_gift_card_code() TO service_role;
