-- Add cafe_orders to the realtime publication so admin pages get instant push events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cafe_orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_orders';
  END IF;
END
$$;

-- Make sure UPDATE/DELETE events carry full row data (needed for status filtering)
ALTER TABLE public.cafe_orders REPLICA IDENTITY FULL;