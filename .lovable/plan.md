## Goal
Add two **Iraqi Children Foundation fundraiser** sessions on **Tue, May 12, 2026** — Signature Flow Pilates with Duha A, $40/person, 100% of proceeds donated, capacity 8, in the Reformer Studio.

| # | Time | Class | Instructor | Capacity | Price |
|---|------|-------|------------|----------|-------|
| 1 | 11:00 AM – 11:50 AM | Signature Flow Pilates – All Levels | Duha A | 8 | **$40** |
| 2 | 12:00 PM – 12:50 PM | Signature Flow Pilates – All Levels | Duha A | 8 | **$40** |

Today the system has no per-session pricing or notes field, so we'll add minimal support for one-off fundraiser/special sessions, then create these two.

## Step 1 — Migration: extend `class_sessions`
Add nullable columns (no impact on existing rows):
- `is_fundraiser boolean NOT NULL DEFAULT false`
- `fundraiser_beneficiary text` — e.g. "Iraqi Children Foundation"
- `session_notes text` — public-facing note, e.g. "100% of proceeds donated to the Iraqi Children Foundation"
- `override_price_cents integer` — when set, this is the drop-in price for this specific session (overrides the standard $25/$30 single-class price)

Then insert the two ad-hoc sessions:
- `schedule_id = NULL` (won't be touched by weekly reconciliation)
- `class_type_id = 8d29b6d1-…` (Signature Flow Pilates – All Levels)
- `instructor_id = 284f1cc6-…` (Duha A)
- `room = 'Reformer Studio'`, `max_capacity = 8`
- `is_fundraiser = true`, `fundraiser_beneficiary = 'Iraqi Children Foundation'`
- `session_notes = '100% of proceeds will be donated to the Iraqi Children Foundation.'`
- `override_price_cents = 4000`

## Step 2 — Display the fundraiser badge & note
Wherever sessions render (members & public schedule, admin roster):
- `src/pages/Schedule.tsx` and `ClassTypeDetail.tsx` (member/public)
- `src/pages/admin/Classes.tsx` / roster (admin)

Add: a **"Fundraiser"** badge + a small line "100% of proceeds donated to {beneficiary}" when `is_fundraiser = true`. Show `$40` price clearly on the booking CTA when `override_price_cents` is set.

## Step 3 — Honor the $40 price at booking
Single-class booking already supports paying for non-members and members-without-credits via the existing single-class-pass flow (`ClassPasses.tsx`, `stripe-payment` edge function).

Update the booking/checkout path to:
1. Read `override_price_cents` from the session being booked.
2. If set, use that amount (in cents) for the Stripe charge instead of the standard $25/$30 price, and bypass any "use a credit" path so everyone pays cash for the fundraiser. Members can still book — they just pay $40 like anyone else (so 100% can be donated).
3. Label the Stripe charge description: `Iraqi Children Foundation Fundraiser — Signature Flow Pilates (May 12, 11:00 AM)` so it's easy to total in the Stripe dashboard.

## Step 4 — Helpful follow-ups (optional, ask before doing)
- Send an SMS/email blast announcing the fundraiser via Marketing → Compose.
- Pin a banner on `/schedule` for the week of May 12 calling out the fundraiser.

## Files
- New migration adding the 4 columns + two `INSERT` rows.
- `src/pages/Schedule.tsx`, `src/pages/ClassTypeDetail.tsx`, admin roster — fundraiser badge + note + price display.
- `src/pages/ClassPasses.tsx` (and/or the booking dialog that calls `stripe-payment`) — pass `session_id` so backend can read `override_price_cents`.
- `supabase/functions/stripe-payment/index.ts` — when a `session_id` is provided and the session has `override_price_cents`, charge that amount and force a no-credit cash purchase; set descriptive line item.
- `src/integrations/supabase/types.ts` — auto-regenerated.

## Notes
- Existing 11:00 AM "Pilates Foundations – Beginner" on May 12 is `is_hidden = true`, so no visible conflict.
- All times stored in `America/Chicago` per project policy.
