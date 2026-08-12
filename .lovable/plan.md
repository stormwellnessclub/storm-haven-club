# Why guest passes stop at "the 17th"

## What's happening

There is no fixed cutoff date in the system. The public guest pass page (`/guest-pass`) only lets a visitor pick a visit date within a **rolling 7-day window** from today:

- Earliest selectable date: today
- Latest selectable date: today + 7 days

Anyone who tried to buy on August 10 saw the calendar stop at August 17 — that's the 7-day cap, not a hard date. Today (August 12) the calendar allows up to August 19, and tomorrow it moves to August 20.

The checkout function does not enforce any date range of its own; it only requires a visit date to be present. So the 7-day calendar limit is the sole restriction.

## Options

If the 7-day window is too short, it can be changed:

1. Extend the window (e.g. 14, 30, or 60 days out).
2. Make the window length an admin setting so it can be adjusted without a code change.
3. Leave it as is — the message to members is simply "book your guest visit within a week."

## Technical notes

- `src/pages/GuestPass.tsx` — `minDate = startOfDay(new Date())`, `maxDate = addDays(new Date(), 7)`, applied to the calendar's `disabled` predicate.
- `supabase/functions/stripe-payment/index.ts` — guest pass checkout validates that `validDate` exists but does not bound it; if the window is changed client-side, a matching server-side bound should be added there so the rule can't be bypassed.

Tell me which option you want and I'll implement it.
