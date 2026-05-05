## Issue
The public `/schedule` page renders class cards with its own inline markup (not the shared `ClassCard` component), and its query/`ClassSession` interface don't include fundraiser fields. So Tue May 12 11 AM and 12 PM render as plain cards with no Fundraiser badge or "Iraqi Children Foundation" label.

The shared `ClassCard` already renders the fundraiser badge + donation callout correctly, but it's used on other surfaces — not on `/schedule`.

## Fix — `src/pages/Schedule.tsx`

1. **Extend the local `ClassSession` interface** (lines 38–61) with optional `is_fundraiser`, `fundraiser_beneficiary`, `session_notes`, `override_price_cents`.

2. **Extend the Supabase query** (lines 178–183) to select those four columns.

3. **Pass them through `buildBookable`** (lines 84–113) so the BookingModal also sees them when opened from `/schedule`.

4. **Render a fundraiser ribbon inside the card** (around lines 467–506):
   - Pink "♥ Fundraiser" badge next to the class name.
   - Below the title row, a small rose-tinted callout: `$40 · Iraqi Children Foundation — 100% of proceeds will be donated.`
   - Replace the "Book" button label with **"Donate & Reserve"** for fundraiser sessions.

5. **Pass fundraiser info to `openDetailsFor`** so the details dialog (`ClassDetailsData`) can also show it. If `ClassDetailsData` doesn't already accept fundraiser fields, add optional `isFundraiser`, `fundraiserBeneficiary`, `sessionNotes`, `overridePriceCents` and surface them in the details dialog component.

## Notes
- No DB or RPC changes; the May 12 sessions already have `is_fundraiser=true`, `fundraiser_beneficiary='Iraqi Children Foundation'`, `override_price_cents=4000`, and the donation note.
- All other class cards on `/schedule` render unchanged because the new UI is gated on `session.is_fundraiser`.
- The BookingModal already handles fundraiser checkout — once the data flows through `buildBookable`, opening the modal from `/schedule` will show the "Donate $40 & Reserve Spot" button as expected.
