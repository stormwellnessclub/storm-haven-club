

## Spa / Front Desk POS

### What this does

Create a new **Front Desk POS** page that works just like the Cafe POS but is designed for spa and front desk sales. It reuses the same menu item database (categories, items, add-ons) so everything stays in sync -- any item added in one POS appears in both.

A new "Spa" category will be added to the existing menu system so spa services (Red Light Therapy, ZeroBody Cryo, etc.) can be managed and sold from both terminals.

### Changes

**1. Add "Spa" category to the menu database**
- Insert a new `cafe_menu_categories` row with name "Spa" so staff can immediately start adding spa items with prices.

**2. Create Front Desk POS page (`src/pages/admin/FrontDeskPOS.tsx`)**
- Same layout as Cafe POS: tabbed Order Queue + POS Terminal
- Reuses `CafePOSMenu` and `CafePOSCart` components (shared item catalog)
- Optional category filter so staff can quickly narrow to "Spa" items or view all
- Orders created with a `source: "front_desk"` tag to distinguish from cafe orders

**3. Add sidebar link and route**
- Add "Front Desk POS" to the admin sidebar under Services (icon: `Sparkles`) with roles: `super_admin`, `admin`, `manager`, `front_desk`, `spa_staff`
- Add route `/admin/front-desk` in `App.tsx`

**4. Update CafePOSMenu to support optional category filtering**
- Add an optional `filterCategories` prop so the Front Desk POS can default to showing spa-related categories while still allowing access to all items
- No changes to Cafe POS behavior (it continues showing everything)

### Technical details

- No new database tables needed -- spa items live in the existing `cafe_menu_categories` / `cafe_menu_items` / `cafe_menu_addons` tables
- The ChargeItemSelector already pulls from these tables, so any spa items added will automatically appear in the member charge dropdown too
- Tax calculation (MI 6%) applies uniformly to all POS items
- Files changed: `src/pages/admin/FrontDeskPOS.tsx` (new), `src/components/admin/CafePOSMenu.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/App.tsx`
