
DROP POLICY IF EXISTS "Users can view their own mothers day vouchers" ON public.mothers_day_vouchers;
CREATE POLICY "Users can view their own mothers day vouchers"
ON public.mothers_day_vouchers
FOR SELECT
TO authenticated
USING (
  buyer_user_id = auth.uid()
  OR LOWER(buyer_email) = public.current_user_email_lower()
  OR LOWER(COALESCE(recipient_email, '')) = public.current_user_email_lower()
);

CREATE TABLE IF NOT EXISTS public.mothers_day_voucher_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.mothers_day_vouchers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('recipient', 'buyer', 'self')),
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  resend_id TEXT,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mothers_day_voucher_emails_voucher
  ON public.mothers_day_voucher_emails(voucher_id, created_at DESC);

ALTER TABLE public.mothers_day_voucher_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view voucher email log"
ON public.mothers_day_voucher_emails
FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[])
);

CREATE POLICY "Users can view email log for own vouchers"
ON public.mothers_day_voucher_emails
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mothers_day_vouchers v
    WHERE v.id = voucher_id
      AND (
        v.buyer_user_id = auth.uid()
        OR LOWER(v.buyer_email) = public.current_user_email_lower()
        OR LOWER(COALESCE(v.recipient_email, '')) = public.current_user_email_lower()
      )
  )
);

CREATE OR REPLACE FUNCTION public.link_mothers_day_vouchers_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mothers_day_vouchers
  SET buyer_user_id = NEW.id
  WHERE buyer_user_id IS NULL
    AND LOWER(buyer_email) = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_mothers_day_vouchers_on_user_creation ON auth.users;
CREATE TRIGGER link_mothers_day_vouchers_on_user_creation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_mothers_day_vouchers_to_user();

UPDATE public.mothers_day_vouchers v
SET buyer_user_id = u.id
FROM auth.users u
WHERE v.buyer_user_id IS NULL
  AND LOWER(v.buyer_email) = LOWER(u.email);
