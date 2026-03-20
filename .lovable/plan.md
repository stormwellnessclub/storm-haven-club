

## Fix Cafe Menu: Mobile Loading, Category Segmentation, and Item Reordering

### Problems Found

1. **Mobile not loading**: The `cafe_menu_categories` and `cafe_menu_items` tables have RLS policies that only allow **staff roles** to SELECT. Public/non-staff users get empty results. This is why the cafe menu loads when you're logged in on desktop (as admin) but not on your phone (likely not logged in or not staff).

2. **All items showing under cafe tab**: Categories like "Spa", "Apparel", "Supplements", "Grip Socks", and "KITSCH" are all stored in the same `cafe_menu_categories` table alongside actual cafe items. The `/cafe` page shows ALL active categories with no way to filter out non-cafe items.

3. **No reordering**: There's no drag-and-drop or manual reorder UI in the Cafe Menu Manager to rearrange items or move them between sections.

### Solution

#### 1. Database: Add public read policies + section field
- Add **public SELECT policies** on `cafe_menu_categories` and `cafe_menu_items` so anyone can view active menu items (these are meant to be public-facing)
- Add a `section` column to `cafe_menu_categories` with values: `'cafe'`, `'spa'`, `'shop'` (default `'cafe'`) — this lets us segment which categories appear on the cafe page vs. Storm Shop vs. POS-only

#### 2. Filter `/cafe` page to cafe-only categories
- Update `useCafeMenuCategories()` to accept an optional `section` filter
- On the `/cafe` page, only fetch categories where `section = 'cafe'`
- POS terminals continue to show all categories (no section filter)

#### 3. Admin: Add section assignment + drag-and-drop reordering
- In the **Cafe Menu Manager**, add a section dropdown on each category (Cafe / Spa / Shop) so you can reassign categories
- Add **drag-and-drop reordering** for both categories (left panel) and items within categories (right panel) using `display_order` field
- Up/down arrow buttons as a simpler alternative if drag-and-drop is too complex

#### 4. Update existing categories with correct sections
- Set `section = 'spa'` for: Spa
- Set `section = 'shop'` for: Apparel, Supplements, Grip Socks, KITSCH
- Everything else stays as `section = 'cafe'`

### Technical Details

**Migration SQL:**
```sql
-- Add section column
ALTER TABLE cafe_menu_categories 
  ADD COLUMN section text NOT NULL DEFAULT 'cafe';

-- Add public read policies
CREATE POLICY "Public can view active categories" 
  ON cafe_menu_categories FOR SELECT TO anon, authenticated 
  USING (is_active = true);

CREATE POLICY "Public can view active menu items"
  ON cafe_menu_items FOR SELECT TO anon, authenticated 
  USING (is_active = true);

-- Set correct sections for existing categories
UPDATE cafe_menu_categories SET section = 'spa' WHERE name = 'Spa';
UPDATE cafe_menu_categories SET section = 'shop' 
  WHERE name IN ('Apparel', 'Supplements', 'Grip Socks', 'KITSCH');
```

**Files to modify:**
- `src/hooks/useCafeMenu.ts` — add section filter to category queries
- `src/pages/Cafe.tsx` — pass `section: 'cafe'` filter
- `src/pages/admin/CafeMenuManager.tsx` — add section dropdown per category + reorder buttons (up/down arrows) for categories and items
- `src/components/admin/CafePOSMenu.tsx` — no section filter (POS shows all)

