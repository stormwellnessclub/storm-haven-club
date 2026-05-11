## Add Room and Heat filters to Book Class

The Book Class page (member + non-member) renders `<ScheduleBrowser />`. Both surfaces share this one component, so a single edit covers both audiences.

### What's there today
- One filter row with category chips: All / Pilates & Cycling / Aerobics / Other
- Each session already carries `session.room` ("Reformer Studio", "Cycle Studio", "Aerobics Studio") and `class_type.is_heated`

### What changes
Replace the current single-row category chips with **two filter groups** on the Book Class schedule:

1. **Studio / Room** (filters by `session.room`)
   - All Studios
   - Reformer Pilates  -> `Reformer Studio`
   - Cycling -> `Cycle Studio`
   - Aerobics -> `Aerobics Studio`

2. **Temperature** (filters by `class_type.is_heated`)
   - All
   - Heated
   - Non-heated

Both filters combine with AND. Defaults: "All Studios" + "All". A small "Clear filters" link appears when any non-default value is selected.

### Files touched
- `src/components/booking/ScheduleBrowser.tsx` only
  - Add `roomFilter` and `heatFilter` state
  - Extend the `.filter(...)` chain at the existing category filter spot to also apply room + heat
  - Replace the existing chip row with two compact chip rows (or a single wrap row with a subtle divider) using existing `filter-badge` / `filter-badge-active` styles for visual consistency
  - Keep the existing category chips? -> Remove the category chips. The new Studio filter is a clearer, more specific replacement and avoids three overlapping filter axes. The legacy `categoryFilter` state and logic are deleted.
  - Sticky filter header behavior, week navigation, and embedded layout (used by Book Class pages) all stay the same

### Out of scope
- No DB / RPC / booking logic changes
- No changes to `/schedule` public route behavior beyond what ScheduleBrowser already controls (it's the same component, so the public page gets the upgraded filters too — which is desirable and consistent)
- No changes to Spa / Kids Care booking
