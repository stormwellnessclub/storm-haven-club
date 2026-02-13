

## Add Cafe / Juice Bar Sales to Member Charge Selector

### What You'll Get

A new **"Cafe / Juice Bar"** group in the charge item dropdown on the Member Detail page. Staff can:
- Select from previously added cafe/juice items
- Add new items with **brand name**, **flavor**, and **price**
- New items are saved to the database so they appear for all staff going forward (no re-adding)

### How It Works

1. In the existing charge item dropdown, a new group called "Cafe / Juice Bar" appears alongside Membership, Fees, Class Passes, etc.
2. The last option in that group is **"+ Add New Item"**
3. Clicking it opens a small inline form: Brand Name, Flavor, Price
4. Once saved, the item is stored in a new `cafe_menu_items` database table and immediately available in the dropdown
5. All items show as: **"Brand - Flavor ($X.XX)"**

### Files to Change

| File | Change |
|------|--------|
| Database migration | Create `cafe_menu_items` table (id, brand_name, flavor, price, is_active, created_at, created_by) with RLS for staff |
| `src/components/admin/ChargeItemSelector.tsx` | Add "Cafe / Juice Bar" group that loads items from DB, plus inline "Add New Item" form |

### Technical Details

**New table: `cafe_menu_items`**

```text
id           uuid (PK, default gen_random_uuid())
brand_name   text NOT NULL
flavor       text NOT NULL
price        numeric NOT NULL
is_active    boolean DEFAULT true
created_at   timestamptz DEFAULT now()
created_by   uuid (auth.uid())
```

RLS policies:
- Staff (super_admin, admin, manager, front_desk) can SELECT, INSERT, UPDATE
- No public access

**ChargeItemSelector changes:**
- Fetch `cafe_menu_items` (where `is_active = true`) on mount using a simple `useQuery`
- Map each DB item into the existing `ChargeItem[]` array under group "Cafe / Juice Bar"
- Add a special "Add New Item" entry at the bottom of the group
- When "Add New Item" is selected, show inline fields (brand, flavor, price) instead of the normal amount/description fields
- On save, insert into `cafe_menu_items`, refetch the list, and auto-select the new item
- The charge description auto-fills as "Cafe - Brand Flavor" with `chargeType: "cafe"`

