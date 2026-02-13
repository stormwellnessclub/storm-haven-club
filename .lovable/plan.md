

## Overhaul Cafe/Juice Bar Menu System with Categories, Add-ons, and Michigan Sales Tax

### What You'll Get

A fully categorized, admin-customizable beverage and food menu in the POS and member charge system. Staff can manage everything themselves without needing developer help.

### Menu Structure

The menu will be organized into these categories (each manageable by staff):

| Category | Item Fields | Example |
|----------|------------|---------|
| **Water** | Brand, Size, Price | Fiji, 500ml, $3.50 |
| **Cold Pressed Juice** | Brand, Flavor, Size, Price | Pressed Juicery, Greens 3, 16oz, $9.00 |
| **Shots** | Brand, Flavor, Size, Price | Pressed Juicery, Ginger Collagen, 2oz, $6.00 |
| **Energy Drinks** | Brand, Flavor, Size, Price | Celsius, Sparkling Watermelon, 12oz, $4.00 |
| **Cafe** | Name, Description, Price | Latte, Oat Milk, $5.50 |
| **Protein Shakes** | Protein Flavor (Vanilla/Chocolate/Other + write-in), Price | Vanilla Shake, $9.00 |
| **Amino Acids** | Brand, Flavor, Size, Price | Same pattern |
| **Preworkout** | Brand, Flavor, Size, Price | Same pattern |

### Protein Shake Add-ons (automatically available for protein shakes)

| Add-on | Price |
|--------|-------|
| Cream Pure Creatine 3mg | +$2.00 |
| Cream Pure Creatine 5mg | +$3.00 |
| Colostrum | +$4.00 |
| Collagen | +$4.00 |
| Extra Protein | +$4.00 |

Staff can also add new add-ons from the UI without developer help.

### Michigan Sales Tax

- **6% Michigan state tax** automatically calculated on all cafe/beverage items
- Shown as a separate line item in the cart before checkout
- Tax amount included in the total sent to Stripe
- Description sent to Stripe will include "(incl. MI tax)"

### Admin Self-Service Capabilities

Staff will be able to:
- **Add new categories** (e.g., "Kombucha", "Smoothie Bowls") directly from the UI
- **Add new items** to any category with the appropriate fields
- **Add new add-ons** that can attach to Protein Shakes (or any future category)
- **Edit prices** of existing items
- **Deactivate items** they no longer sell (soft delete)

### Files to Change

| File | Change |
|------|--------|
| Database migration | Restructure `cafe_menu_items` table: add `category`, `size`, `item_name`, `description` columns. Create new `cafe_menu_addons` table for add-ons. Create `cafe_menu_categories` table for admin-managed categories. |
| `src/components/admin/ChargeItemSelector.tsx` | Replace flat "Cafe / Juice Bar" group with category-based groups, protein flavor picker, add-on checkboxes, tax line, and "Add Category" / "Add Item" / "Add Add-on" capabilities |
| `src/pages/admin/CafePOS.tsx` | Replace hardcoded `menuItems` array with DB-driven categories and items, add add-on selection for protein shakes, show tax line in cart |

### Technical Details

**New table: `cafe_menu_categories`**

```text
id             uuid PK
name           text NOT NULL (e.g. "Water", "Cold Pressed Juice", "Protein Shakes")
display_order  integer DEFAULT 0
has_addons     boolean DEFAULT false  (true for Protein Shakes)
is_active      boolean DEFAULT true
created_at     timestamptz DEFAULT now()
```

RLS: Staff (super_admin, admin, manager, front_desk) can SELECT, INSERT, UPDATE.

**Updated table: `cafe_menu_items` (add columns)**

```text
-- Existing columns stay (brand_name, flavor, price, is_active, created_by)
+ category_id   uuid REFERENCES cafe_menu_categories(id)  -- links to category
+ item_name     text  -- general name field (for Cafe items like "Latte")
+ size          text  -- e.g. "16oz", "500ml" (nullable)
+ description   text  -- optional notes
+ protein_flavor text -- for protein shakes: "vanilla", "chocolate", or custom text
```

RLS: Existing policies remain.

**New table: `cafe_menu_addons`**

```text
id             uuid PK
name           text NOT NULL (e.g. "Cream Pure Creatine 3mg")
price          numeric NOT NULL (e.g. 2.00)
category_id    uuid REFERENCES cafe_menu_categories(id)  -- which category this add-on applies to
is_active      boolean DEFAULT true
display_order  integer DEFAULT 0
created_at     timestamptz DEFAULT now()
created_by     uuid
```

RLS: Staff can SELECT, INSERT, UPDATE.

**Seed data** (inserted via migration):
- 8 default categories: Water, Cold Pressed Juice, Shots, Energy Drinks, Cafe, Protein Shakes, Amino Acids, Preworkout
- Protein Shakes category has `has_addons = true`
- 5 default add-ons for Protein Shakes: Creatine 3mg (+$2), Creatine 5mg (+$3), Colostrum (+$4), Collagen (+$4), Extra Protein (+$4)

**Tax calculation (frontend):**
- Michigan sales tax rate: 6%
- Applied to all items in the cafe charge
- Shown as a separate line: "MI Sales Tax (6%): $X.XX"
- Total sent to Stripe = subtotal + tax
- Charge description includes "(incl. MI 6% tax)"

**ChargeItemSelector changes:**
- Categories fetched from `cafe_menu_categories`
- Items grouped under their category in the dropdown
- When a Protein Shake item is selected, show: protein flavor picker (Vanilla / Chocolate / Other with text input) and add-on checkboxes
- Add-on prices added to the item total
- "Add New Category" button opens inline form (category name)
- "Add New Item" available per category
- "Add New Add-on" available for categories with `has_addons = true`
- Tax line shown below subtotal before charge button

**CafePOS changes:**
- Menu items loaded from database grouped by category
- Category tabs or sections replace the hardcoded grid
- Protein shake selection shows flavor picker and add-on checkboxes
- Cart shows subtotal, tax line, and total
- Tax included in the amount sent to Stripe

