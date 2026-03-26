

# Fix Café Menu Display — Show Flavors & Structured Descriptions

## Problems
1. **Missing flavors**: `getItemDisplayName()` returns `item_name` alone if set, ignoring `flavor`. So items with both fields only show the name.
2. **Description is one blob**: The `description` field contains structured content (item description, benefits, nutritional profile) but it's rendered as a single paragraph.

## Solution

### 1. Show flavors alongside item name
Update `getItemDisplayName` to always include `flavor` when present, e.g. "Acai Bowl — Mixed Berry" instead of just "Acai Bowl".

### 2. Parse description into structured sections
Instead of adding new database columns, parse the existing `description` text by splitting on common headings the user is already using (e.g. "Benefits:", "Nutritional Profile:", "Nutrition:"). Display each section with its own heading and visual separation:

- **Description** — main item description (everything before the first heading)
- **Benefits** — if present, shown with a subtle heading
- **Nutritional Profile** — if present, shown with a subtle heading

Each section gets its own styled block with a small label, keeping the card clean and scannable.

### Files to change
- **Edit**: `src/pages/Cafe.tsx`
  - Fix `getItemDisplayName` to include flavor
  - Replace `getItemDescription` with a `parseItemDescription` function that returns `{ description, benefits, nutrition }` by splitting on heading keywords
  - Render each section separately in the card with small bold labels and spacing

