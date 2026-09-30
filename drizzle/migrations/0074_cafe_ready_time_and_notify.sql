ALTER TABLE public.cafe_orders
  ADD COLUMN IF NOT EXISTS ready_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS delay_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.staff_set_cafe_ready_time(p_order_id uuid, p_add_minutes integer DEFAULT NULL, p_ready_at timestamptz DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _new timestamptz;
BEGIN
  PERFORM public.assert_kiosk_staff();
  IF p_ready_at IS NULL AND (p_add_minutes IS NULL OR p_add_minutes < 1 OR p_add_minutes > 180) THEN
    RAISE EXCEPTION 'Choose a valid ready time';
  END IF;
  UPDATE public.cafe_orders
     SET estimated_ready_at = coalesce(p_ready_at, greatest(coalesce(estimated_ready_at, now()), now()) + make_interval(mins => p_add_minutes)),
         updated_at = now()
   WHERE id = p_order_id AND status IN ('pending','preparing')
  RETURNING estimated_ready_at INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'Order is not open'; END IF;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.staff_set_cafe_ready_time(uuid,integer,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_cafe_ready_time(uuid,integer,timestamptz) TO authenticated;