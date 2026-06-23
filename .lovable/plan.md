## Goal
Reorganize the Coffee Bar in the cafe menu and add proper customization (temperature, sweetness, milk) to coffee/latte/matcha drinks.

## 1. Category restructure
Current category "Coffee and Lattes" mixes coffee and matcha. Split into two:

- **Coffee & Lattes** (rename existing `Coffee and Lattes`, keep id `ab6e378d…`)
  - Latte ($9)
  - Latte ($8)
  - Dalgona Whipped Nescafe ($9)
  - Dalgona ($6, currently inactive — leave as-is)
- **Matcha** (new category, `has_addons: true`, placed right after Coffee & Lattes)
  - Honey Comb Matcha ($9)
  - Strawberry Matcha ($9)
  - Matcha ($9)

Done via a migration that inserts the new category and updates `category_id` for the three matcha items.

## 2. Photo refresh
For each item in both categories, swap in a clean, premium, on-brand image (warm minimal, soft daylight, ceramic cups, matcha/coffee close-ups). Generated with the image tool, uploaded via lovable-assets, then `cafe_menu_items.image_url` updated. List of items getting new photos:
- Latte (x2), Dalgona Whipped Nescafe, Honey Comb Matcha, Strawberry Matcha, Matcha.

## 3. Customization options (Coffee, Lattes, Matcha)
Add three option groups to every item in Coffee & Lattes and Matcha:

- **Temperature** — Iced / Hot (single-select, required, no price)
- **Sweetness** — Unsweetened / Light / Regular / Extra (single-select, required, no price)
- **Milk** — Whole / 2% / Almond / Oat (single-select, required, no price)

### Schema change
Extend `cafe_menu_addons` with:
- `group_name text` (e.g. `Temperature`, `Sweetness`, `Milk`)
- `selection_type text default 'multi'` — `single` for radio groups, `multi` for current checkbox add-ons
- `is_required boolean default false`

Backfill existing add-ons with `group_name = 'Add-ons'`, `selection_type='multi'`. Seed the new option rows scoped to the Coffee & Lattes and Matcha categories (price 0, `selection_type='single'`, `is_required=true`).

### UI change — `CafeAddonDialog.tsx`
- Group addons by `group_name`.
- Render `single` groups as a `RadioGroup` (required: default to first option, block confirm if missing).
- Render `multi` groups as today's checkboxes.
- Cart line items capture the selected option label per group (e.g. "Latte — Iced · Regular sweetness · Oat milk") so the cafe POS/order ticket shows the barista what to make. Order-item `name` string composed in `CafeOrderContent` when confirming.

### Admin
`CafeMenuManager` add-on editor gains `group_name` and `selection_type` fields so staff can add new option groups later. Not changing other admin behavior.

## 4. Out of scope
- No pricing changes.
- No changes to other categories (Smoothies, Juices, etc.) beyond display order shifting to fit the new Matcha category.
- No changes to checkout, tax, or fee logic.

## Files touched
- `supabase/migrations/<new>.sql` — schema columns + Matcha category + reassign items + seed option groups
- `src/hooks/useCafeMenu.ts` — extend `CafeMenuAddon` type
- `src/components/cafe/CafeAddonDialog.tsx` — grouped radio/checkbox rendering + required validation + label composition
- `src/components/cafe/CafeOrderContent.tsx` — pass composed option labels into order item name
- `src/pages/admin/CafeMenuManager.tsx` — addon group/type fields
- New `.asset.json` pointers under `src/assets/cafe/` for the refreshed photos
