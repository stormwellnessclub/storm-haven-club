## Surface functional benefit tags on cafe menu cards

Right now smoothies and other items only show category/size/calories on the card — benefit info (Hydration, Immunity, Energy, Gut Support, Antioxidant, etc.) is hidden behind "View details". Add small uppercase pill badges directly under the meta line, matching the reference screenshot.

### Where
`src/components/cafe/CafeOrderContent.tsx` — the item card (~lines 920–940), right after the category/size/kcal meta and before the description teaser.

### Tag source (in priority order)
1. **`item.dietary_tags`** (already exists on `cafe_menu_items`) — primary source. Admin-controlled, exact text.
2. **Derived from `parsed.functionalBlend`** — fallback. For each functional blend entry, extract a 1–2 word benefit keyword from the benefit text (e.g. "supports hydration" → HYDRATION). Used only when `dietary_tags` is empty so existing data still surfaces tags automatically.

Cap display at 3 pills per card; remaining count rolls into "View details".

### Pill style (matches reference)
- Small outlined pill, rounded-full, border `cafe-line`, uppercase `font-cafe-mono` text-[9px] tracking-widest, terracotta or burgundy text.
- Rendered as a flex-wrap row with `gap-1.5`, `mb-3`, sits between meta line and description teaser.

### Scope
- Display only. No schema changes, no admin UI changes in this pass (admin already edits `dietary_tags` via the menu manager).
- Applies to the customer-facing `CafeOrderContent` (both `public` and `nonmember` variants). POS/admin views untouched.

### Optional follow-up (not in this change)
- Filter pills above the grid ("All / Functional / Protein / Refreshing / Immunity") like the reference screenshot — happy to add in a separate pass if you want.