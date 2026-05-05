## Goal
Make the two May 12 Iraqi Children Foundation fundraiser sessions display as non-heated, without changing any other sessions tied to the heated "Signature Flow Pilates – All Levels" class type.

## Why a migration is needed
`is_heated` is stored on `class_types`, not on `class_sessions`. We can't just toggle a flag on the two sessions. The cleanest fix is to repoint those two sessions to the existing non-heated class type already in the database:

- Current class type: `Signature Flow Pilates – All Levels` (id `8d29b6d1-1b37-4bca-aa7d-13aca36b8059`, `is_heated = true`)
- Target class type: `Signature Flow` (id `cf22bbe2-298d-4f36-9741-85559b242e9e`, `is_heated = false`)

Both are in the `pilates_cycling` category, so credit/pass eligibility and pricing rules remain unchanged. Fundraiser flags (`is_fundraiser`, `fundraiser_beneficiary`, `override_price_cents`, `session_notes`) live on the session itself and stay as-is — the $40 donation flow is unaffected.

## Changes

1. **New migration** — update only the two fundraiser sessions:
   ```sql
   UPDATE public.class_sessions
   SET class_type_id = 'cf22bbe2-298d-4f36-9741-85559b242e9e'
   WHERE id IN (
     'aad7a9f7-d673-4f7e-b4fc-a4dffa9c6026',
     '228e3197-02ac-465e-a58e-f1694fbac84f'
   )
   AND is_fundraiser = true;
   ```
   Scoped by id + `is_fundraiser = true` so it can't accidentally touch other sessions.

## Result
- The two May 12 fundraiser cards on `/schedule`, `BookingModal`, `ClassDetailsSheet`, and `MyBookings` will no longer render the "Heated" badge.
- All other Signature Flow Pilates – All Levels sessions remain heated and untouched.
- Fundraiser badge, "$40 · Iraqi Children Foundation" callout, and "Donate & Reserve" donation checkout flow are unaffected.

## Out of scope
No code changes, no UI changes, no RPC changes — purely a data correction migration.