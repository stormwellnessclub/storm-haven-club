ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_payment_method_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_payment_method_check
  CHECK (payment_method = ANY (ARRAY['card_on_file','cash','clover','external','stripe_online','comp','check','venmo']));