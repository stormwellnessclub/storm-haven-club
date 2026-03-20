
-- Add section column to cafe_menu_categories
ALTER TABLE cafe_menu_categories 
  ADD COLUMN section text NOT NULL DEFAULT 'cafe';

-- Add public read policies for cafe_menu_categories
CREATE POLICY "Public can view active categories" 
  ON cafe_menu_categories FOR SELECT TO anon, authenticated 
  USING (is_active = true);

-- Add public read policies for cafe_menu_items  
CREATE POLICY "Public can view active menu items"
  ON cafe_menu_items FOR SELECT TO anon, authenticated 
  USING (is_active = true);

-- Add public read policies for cafe_menu_addons
CREATE POLICY "Public can view active addons"
  ON cafe_menu_addons FOR SELECT TO anon, authenticated 
  USING (is_active = true);
