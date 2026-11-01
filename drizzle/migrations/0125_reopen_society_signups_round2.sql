CREATE OR REPLACE FUNCTION public.hss_enforce_signup_close()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Round 2 sign-ups and book suggestions are open through Sunday, Nov 15, 2026 (Detroit).
  IF COALESCE(NEW.source, 'self') = 'self'
     AND now() > timestamptz '2026-11-15 23:59:59 America/Detroit' THEN
    RAISE EXCEPTION 'Higher Self Society sign-ups are closed.';
  END IF;
  RETURN NEW;
END $$;