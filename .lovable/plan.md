## Verified current state

- `/admin/events` (**EventsHub**) — shows event cards with only `Sold / capacity` and `Revenue`. No names, no abandoned count. This is what you're looking at.
- `/admin/events/:slug` (**EventDetail**, reached via the "Manage" button) — already renders a full roster table (Name, Email, Phone, Type, Account, Status, Amount, Purchased) with tabs for Paid / Pending / Abandoned / Refunded and a CSV export. RLS policies confirm admin can read everything.
- `event_tickets` currently has no `abandon_reason` column and we never cancel the Stripe PaymentIntent when we sweep a row to `abandoned`, so those PIs sit in Stripe as "Incomplete" for 24h.

## Plan

### 1. EventsHub — show roster + abandoned right on the hub
On each event card in `src/pages/admin/EventsHub.tsx`:
- Extend the `ticketStats` query to also count `pending (active, <30 min old)`, `abandoned`, and `refunded`.
- Add a compact rows list under each card showing the last ~5 paid buyers (Name · Type · Amount) with a "View all N" link to `/admin/events/:slug`.
- Add stat lines: `Abandoned: N` and `Pending: N` alongside Sold/Revenue.
- Fix the top "Tickets sold" summary strip to also show total abandoned across events.

This way the hub itself surfaces names and abandoned tracking without requiring a drill-down click.

### 2. Real abandoned tracking (data + Stripe hygiene)
Migration:
- Add `event_tickets.abandon_reason text` and `event_tickets.abandoned_at timestamptz` columns.

`create-event-ticket-checkout` (and `EventDetail` "Sweep stale" button — refactored to call a small new edge function `sweep-abandoned-event-tickets` so both places use one code path):
- When flipping a `pending` row to `abandoned`, also:
  - Call `stripe.paymentIntents.retrieve(pi_id)` — inspect status and `last_payment_error`.
  - Set `abandon_reason` to one of: `never_entered_card` (status `requires_payment_method`, no error), `declined: <message>` (has `last_payment_error`), `3ds_abandoned` (`requires_action`/`requires_confirmation`), `other`.
  - Call `stripe.paymentIntents.cancel(pi_id, { cancellation_reason: 'abandoned' })` when the PI is cancelable, so it disappears from Stripe's Incomplete list.
  - Set `abandoned_at = now()`.
- Use `Promise.allSettled` so a single Stripe failure doesn't block the batch.

### 3. Surface the reason in EventDetail
In `src/pages/admin/EventDetail.tsx`:
- In the Abandoned tab, show a small badge column with the human-readable reason (`Never entered card`, `Declined: insufficient_funds`, `3DS abandoned`, etc.) using the new `abandon_reason` field.
- Add a `Total abandoned attempts` and `Total pending (active)` line to the KPI grid so it matches what's shown on the hub.

### 4. (Skip unless you want it) Move PI creation to Pay click
Not doing this — bigger rewrite of the embedded checkout dialog for a modest win. The auto-cancel in step 2 already keeps the Stripe Incomplete list clean.

## Files touched

- Migration: `event_tickets.abandon_reason`, `event_tickets.abandoned_at`
- `supabase/functions/create-event-ticket-checkout/index.ts` — extract sweep logic, cancel PIs, record reason
- `supabase/functions/sweep-abandoned-event-tickets/index.ts` — new, staff-guarded (`requireStaff`), used by the admin "Sweep stale" button
- `src/pages/admin/EventsHub.tsx` — richer per-event stats + last-5 roster + abandoned totals
- `src/pages/admin/EventDetail.tsx` — reason badge in Abandoned tab, new KPIs, wire "Sweep stale" to the new function