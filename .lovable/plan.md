## Problem

Mat Sculpt is stored in `class_types.category = 'aerobics'`, but the frontend category mapping only knows about `pilates_cycling` and `other`. So:

- The booking UI can't find any valid passes/credits for an aerobics class → shows "no credits available".
- Existing pilates_cycling passes should be interchangeable with aerobics per your latest policy, but they're being filtered out.
- The display label "Other Classes" / "Aerobics & Other" is confusing — you want it to read "Aerobics".

## Fix

All changes are frontend + one small data cleanup. No RPC changes (the booking RPC doesn't validate category — it already accepts any active class pass/credit).

### 1. Unify categories in `src/lib/classCategories.ts`

Treat `pilates_cycling`, `other`, and `aerobics` as one interchangeable pool for the purposes of passes/credits.

- Update `CATEGORY_DISPLAY_NAMES`:
  - `'other'` → `'Aerobics'` (was "Other Classes")
  - `'aerobics'` → `'Aerobics'` (was "Aerobics & Other")
  - keep `'pilates_cycling'` → `'Class Pass'`
- Update `CLASS_TO_PASS_MAPPING` — add the missing `'aerobics'` key and make everything cross-valid:
  ```ts
  'pilates_cycling': ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
  'other':           ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
  'aerobics':        ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
  ```
- Update `PASS_TO_CLASS_MAPPING` for symmetry (used by admin UIs that ask "what classes can this pass book"):
  ```ts
  'reformer':        ['pilates_cycling', 'other', 'aerobics'],
  'cycling':         ['pilates_cycling', 'other', 'aerobics'],
  'pilates_cycling': ['pilates_cycling', 'other', 'aerobics'],
  'aerobics':        ['pilates_cycling', 'other', 'aerobics'],
  'other':           ['pilates_cycling', 'other', 'aerobics'],
  ```
- `getPassDisplayCategory`: keep grouping under `'pilatesCycling'` since it's now one pool for booking purposes (or leave as-is; no behavior change needed for the two-tab purchase page).

### 2. Data cleanup

Normalize `class_types.category` for consistency (Mat Sculpt is the only `aerobics` row today, but the admin category selector can create more):

- Option A (recommended): leave `category='aerobics'` on Mat Sculpt — the mapping fix above handles it, and the label now reads "Aerobics".
- No column/enum changes; `DatabaseClassCategory` in the TS type already needs `'aerobics'` added to the union so future TS reads don't complain:
  ```ts
  export type DatabaseClassCategory = 'pilates_cycling' | 'other' | 'aerobics';
  ```

### 3. Verify

- Reload the schedule as a Diamond member holding only pilates_cycling passes → Mat Sculpt now shows "Use existing class pass" and the monthly class credit option.
- Admin roster → "Add to class" for a Mat Sculpt session shows the member's pilates_cycling pass in the pass dropdown.
- Class-pass purchase page tabs still render as "Class Pass" and "Aerobics" (no more "Other Classes" wording).

## Files touched

- `src/lib/classCategories.ts` — mapping + display names + type union.

That's the whole change — no migration, no RPC edit, no UI component rewrites.
