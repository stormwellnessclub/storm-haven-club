-- Create pending_non_member_imports table
CREATE TABLE public.pending_non_member_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  pass_category public.class_category NOT NULL DEFAULT 'pilates_cycling',
  pass_type TEXT NOT NULL DEFAULT '10-pack',
  classes_total INTEGER NOT NULL DEFAULT 10,
  expiration_days INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Add unique constraint on email for pending records only
CREATE UNIQUE INDEX pending_imports_email_pending_idx ON public.pending_non_member_imports (LOWER(email)) WHERE status = 'pending';

-- RLS
ALTER TABLE public.pending_non_member_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage pending imports"
  ON public.pending_non_member_imports
  FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- Trigger: auto-fulfill pending imports when a non_member_profile is created
CREATE OR REPLACE FUNCTION public.auto_fulfill_pending_import()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  -- Find any pending import matching this email
  SELECT * INTO v_pending
  FROM public.pending_non_member_imports
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Create the class pass
    INSERT INTO public.class_passes (
      user_id, category, pass_type, classes_total, classes_remaining,
      price_paid, expires_at, status, is_member_price
    ) VALUES (
      NEW.user_id,
      v_pending.pass_category,
      v_pending.pass_type,
      v_pending.classes_total,
      v_pending.classes_total,
      0,
      NOW() + (v_pending.expiration_days || ' days')::INTERVAL,
      'active',
      false
    );

    -- Mark import as fulfilled
    UPDATE public.pending_non_member_imports
    SET status = 'fulfilled', fulfilled_at = NOW()
    WHERE id = v_pending.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_fulfill_pending_import
  AFTER INSERT ON public.non_member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fulfill_pending_import();
