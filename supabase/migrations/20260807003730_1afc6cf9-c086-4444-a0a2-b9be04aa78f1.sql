DO $$
DECLARE base text := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/';
DECLARE m record;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('da1705c5-b92e-4fba-bc2c-041aa0de2024'::uuid,'avocado-toast-v2.jpg'),
    ('00c87212-1aec-4559-98ba-a474d350ca23'::uuid,'mezze-v2.jpg'),
    ('a96a51ba-42c6-4c69-bcd2-769f6a13de3b'::uuid,'mezze-v2.jpg'),
    ('69daead0-afc2-4552-89ff-eeb23f202eb4'::uuid,'labneh-toast-v2.jpg'),
    ('285aeb00-3e2e-4dd7-9133-c8cbada5d668'::uuid,'turkey-melt-v2.jpg')
  ) AS t(id, fname)
  LOOP
    UPDATE public.cafe_menu_items
    SET image_url = base || m.fname,
        image_urls = ARRAY[base || m.fname] || array_remove(COALESCE(image_urls,'{}'), base || m.fname)
    WHERE id = m.id;
  END LOOP;
END $$;