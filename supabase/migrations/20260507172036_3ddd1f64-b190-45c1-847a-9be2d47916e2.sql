
ALTER TABLE public.class_passes
  ADD COLUMN IF NOT EXISTS gift_buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_buyer_name text,
  ADD COLUMN IF NOT EXISTS gift_buyer_email text,
  ADD COLUMN IF NOT EXISTS gift_recipient_name text,
  ADD COLUMN IF NOT EXISTS gift_recipient_email text,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS gift_verification_status text;

CREATE INDEX IF NOT EXISTS idx_class_passes_promo_code
  ON public.class_passes(promo_code) WHERE promo_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_passes_gift_recipient_email
  ON public.class_passes(LOWER(gift_recipient_email)) WHERE gift_recipient_email IS NOT NULL;
