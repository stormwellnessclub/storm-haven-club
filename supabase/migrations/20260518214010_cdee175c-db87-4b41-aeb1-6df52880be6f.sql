DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_categories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_addons;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.cafe_menu_categories REPLICA IDENTITY FULL;
ALTER TABLE public.cafe_menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.cafe_menu_addons REPLICA IDENTITY FULL;