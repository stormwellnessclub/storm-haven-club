

# Café Menu Card Improvements

## Problems (confirmed from preview)

1. **Badge overlap** — Seasonal badge (e.g. "Small Batch French Farm") is `absolute top-3 right-3` and overlaps the item title area, covering chia item titles
2. **Nutritional info is a wall of text** — Benefits and Nutritional Profile sections render as dense inline paragraphs with bullet points running together (visible on the chia pudding card)
3. **Calories invisible** — `text-xs text-muted-foreground` crammed in with dietary tags, easy to miss
4. **Cards feel bland** — flat hierarchy, everything is small muted text, no visual structure

## Changes — `src/pages/Cafe.tsx`

### 1. Fix badge overlap (line 315-321)
- Move the seasonal badge **out of absolute positioning** and into the content area (`p-5` div), rendered as an inline badge **above** the item title
- This eliminates any overlap with titles or images

### 2. Collapsible nutritional info (lines 356-367)
- Wrap the Benefits and Nutritional Profile sections inside a `<Collapsible>` component
- Add a subtle "Nutritional Info ▾" trigger button below the description
- When expanded, show Benefits and Nutritional Profile as structured, labeled sections
- Format the benefits text: split on bullet markers (`•` or `·`) and render as an actual list with `<ul><li>` elements for readability

### 3. Improve calorie visibility (lines 375-377)
- Move calories out of the dietary tags row
- Display as its own line below the price: `text-sm text-foreground/60` — readable but not loud
- Position it near the title/price area so it's noticed

### 4. Minor card hierarchy improvements
- Add `font-medium` to the item title for slightly more weight
- Add slightly more spacing between description and action row

### Files changed
- `src/pages/Cafe.tsx`

