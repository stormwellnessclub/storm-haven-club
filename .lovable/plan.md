

# Comprehensive Cafe Menu Management System

## The Problem

The front-facing Cafe page at `/cafe` shows **fake hardcoded items** (Green Storm smoothie, Acai Bowl, etc.) that have nothing to do with your actual inventory. Meanwhile, the admin POS has the real items (NOOMA, GEORGIE, ELEVE, AllWello, etc.) stored in the database but with no way to edit prices, add images, manage stock, or mark seasonal items. There is also no dedicated admin menu management page -- item creation is buried inside the POS terminal.

## The Solution

### 1. Build a Dedicated Admin Cafe Menu Management Page

Create a new `/admin/cafe-menu` page (separate from the POS) with a master-detail layout following admin design principles:

**Left panel -- Category list with drag-to-reorder**
- View all categories, toggle active/inactive, rename, reorder

**Right panel -- Full item management for selected category**
- Table view of all items (including inactive ones grayed out)
- Inline editing for price, name, brand, flavor, size, description
- Toggle `is_active` to disable/enable items instantly
- Toggle `is_seasonal` with optional seasonal label (e.g., "Summer Special")
- Upload item image (stored in a `cafe_menu_images` storage bucket)
- Set `stock_quantity` (null = unlimited, 0 = sold out, shows "Sold Out" badge)
- Set `display_order` within category
- Add calories and dietary tags
- Bulk actions: deactivate multiple items, update prices

### 2. Database Schema Updates

Add new columns to `cafe_menu_items`:
```text
image_url        TEXT         -- URL to uploaded image
stock_quantity   INTEGER      -- null = unlimited, 0 = sold out
is_seasonal      BOOLEAN      -- default false
seasonal_label   TEXT         -- e.g., "Summer Special", "Limited Time"
display_order    INTEGER      -- sort order within category
calories         INTEGER      -- optional
dietary_tags     TEXT[]        -- e.g., {"Vegan", "GF", "Dairy-Free"}
```

Add new columns to `cafe_menu_categories`:
```text
description      TEXT         -- category description for front-facing menu
image_url        TEXT         -- category hero image
```

Create a storage bucket `cafe-menu-images` for item photos.

### 3. Rebuild Front-Facing Cafe Page from Database

Replace the entire hardcoded menu in `src/pages/Cafe.tsx` with live data from `cafe_menu_items` + `cafe_menu_categories`:

- Pull categories and items from the database (only `is_active = true`)
- Show item images when available (fallback to category image or placeholder)
- Display dietary tags, calories, seasonal badges
- Show "Sold Out" overlay when `stock_quantity = 0`
- Keep the existing cart + payment flow but wire it to real item IDs and prices
- Category filter tabs generated from database categories

### 4. Admin Sidebar Navigation

Add a "Cafe Menu" link in the admin sidebar under the existing "Cafe POS" entry so staff can quickly jump between managing the menu and processing orders.

## Technical Details

### Files to Create
- `src/pages/admin/CafeMenuManager.tsx` -- Full menu management page with category list + item table/editor
- Route registration in `App.tsx`

### Files to Modify
- `src/pages/Cafe.tsx` -- Replace hardcoded items with database queries; wire images, dietary tags, seasonal badges, sold-out states
- `src/hooks/useCafeMenu.ts` -- Add new hooks: `useUpdateCafeMenuItemFull` (all fields), `useDeleteCafeMenuItem` (soft delete), `useUpdateCafeCategory`, `useAllCafeMenuItems` (includes inactive for admin)
- `src/components/admin/AdminSidebar.tsx` -- Add "Cafe Menu" link
- Database migration for new columns + storage bucket

### Database Migration
- ALTER `cafe_menu_items` to add: `image_url`, `stock_quantity`, `is_seasonal`, `seasonal_label`, `display_order`, `calories`, `dietary_tags`
- ALTER `cafe_menu_categories` to add: `description`, `image_url`
- Create `cafe-menu-images` storage bucket with public read access
- RLS: authenticated users can upload to bucket; public can read

### Menu Manager UI Layout
```text
+----------------------------------+----------------------------------------+
| Categories                       | Items in "Energy Drinks"               |
|                                  |                                        |
| [+] Add Category                 | [+] Add Item    [Bulk Edit]            |
|                                  |                                        |
| > Water                          | Brand    | Flavor   | Price | Stock |  |
|   Cold Pressed Juice             | NOOMA    | Tangerine| $5.00 | --    |  |
|   Shots                          | NOOMA    | Cherry   | $5.00 | --    |  |
| * Energy Drinks  <-- selected    | GEORGIE  | Tropical | $4.00 | 12    |  |
|   Cafe                           | ELEVE    | Rose     | $8.00 | --    |  |
|   Protein Shakes                 |                                        |
|   ...                            | [Click row to expand: edit all fields, |
|                                  |  upload image, set seasonal, etc.]     |
+----------------------------------+----------------------------------------+
```

### Front-Facing Menu Rendering
- Each item card shows: image (if available), name, description, price, dietary badges, calorie count
- Seasonal items get a ribbon/badge ("Limited Time", "Summer Special")
- Sold-out items show grayed overlay with "Sold Out" text, add-to-cart disabled
- Categories as horizontal filter tabs (same UX as current, but dynamic)

