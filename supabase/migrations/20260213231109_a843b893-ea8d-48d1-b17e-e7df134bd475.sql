
-- Create cafe_menu_categories table
CREATE TABLE public.cafe_menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer DEFAULT 0,
  has_addons boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cafe_menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cafe menu categories"
  ON public.cafe_menu_categories FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can insert cafe menu categories"
  ON public.cafe_menu_categories FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can update cafe menu categories"
  ON public.cafe_menu_categories FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Add columns to cafe_menu_items
ALTER TABLE public.cafe_menu_items
  ADD COLUMN category_id uuid REFERENCES public.cafe_menu_categories(id),
  ADD COLUMN item_name text,
  ADD COLUMN size text,
  ADD COLUMN description text,
  ADD COLUMN protein_flavor text;

-- Make brand_name and flavor nullable (some categories don't need them)
ALTER TABLE public.cafe_menu_items
  ALTER COLUMN brand_name DROP NOT NULL,
  ALTER COLUMN flavor DROP NOT NULL;

-- Create cafe_menu_addons table
CREATE TABLE public.cafe_menu_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  category_id uuid REFERENCES public.cafe_menu_categories(id),
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.cafe_menu_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cafe menu addons"
  ON public.cafe_menu_addons FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can insert cafe menu addons"
  ON public.cafe_menu_addons FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can update cafe menu addons"
  ON public.cafe_menu_addons FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Seed categories
INSERT INTO public.cafe_menu_categories (name, display_order, has_addons) VALUES
  ('Water', 1, false),
  ('Cold Pressed Juice', 2, false),
  ('Shots', 3, false),
  ('Energy Drinks', 4, false),
  ('Cafe', 5, false),
  ('Protein Shakes', 6, true),
  ('Amino Acids', 7, false),
  ('Preworkout', 8, false);

-- Seed add-ons for Protein Shakes
INSERT INTO public.cafe_menu_addons (name, price, category_id, display_order)
SELECT addon.name, addon.price, c.id, addon.display_order
FROM (VALUES
  ('Cream Pure Creatine 3mg', 2.00, 1),
  ('Cream Pure Creatine 5mg', 3.00, 2),
  ('Colostrum', 4.00, 3),
  ('Collagen', 4.00, 4),
  ('Extra Protein', 4.00, 5)
) AS addon(name, price, display_order)
CROSS JOIN public.cafe_menu_categories c
WHERE c.name = 'Protein Shakes';
