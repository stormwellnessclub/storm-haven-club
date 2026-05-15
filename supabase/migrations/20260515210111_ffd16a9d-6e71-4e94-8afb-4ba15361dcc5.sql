CREATE OR REPLACE FUNCTION public.enforce_application_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.status, 'pending') = 'pending' AND NEW.stripe_customer_id IS NULL THEN
    RAISE EXCEPTION 'A payment method is required to submit a membership application.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_application_payment_method_trigger ON public.membership_applications;

CREATE TRIGGER enforce_application_payment_method_trigger
BEFORE INSERT ON public.membership_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_payment_method();