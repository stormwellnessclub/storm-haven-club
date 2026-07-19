# Event Ticket Sales — Tracking & Non-Member Purchase

## What's already in place (verified)

**Admin tracking — `/admin/events/:slug` (`src/pages/admin/EventDetail.tsx`)**
- KPI cards: Tickets sold / capacity, Member count, Non-Member count, Revenue
- Roster table: Name, Email, Type (Member / Non-Member badge), Status (paid / pending / refunded), Amount, Purchase date
- Live query against `event_tickets` for the event

**Non-member portal — buying in-portal, no redirect off-site**
- `EventAnnouncementBanner` on `/portal/dashboard` (non-member) and `/member/dashboard`
- `PortalUpcomingEvents` inside `/portal/my-tickets`
- All CTAs open `BuyTicketsDialog` — embedded Stripe `PaymentElement`, three steps: details → payment → success confirmation with ticket summary
- Success step shows "Purchase successful", ticket details, and total paid; a confirmation email is triggered from `finalize-event-ticket-payment` + webhook

**Pricing — server-authoritative (`create-event-ticket-checkout`)**
- Ignores any client-supplied type. Server looks up `members` by `user_id` (from auth token) or by `email`, requiring status `active` or `frozen`.
- Match → `member_price_cents` ($30). No match → `non_member_price_cents` ($40). Non-member portal users hit the $40 path correctly.

## Gaps to close

1. **Admin roster is missing phone + export.** Front desk / event captain can't quickly call a buyer or hand a check-in list to the door.
2. **No paid-vs-pending breakdown.** "Tickets sold" currently only counts `paid`, but pending/abandoned rows are invisible — hard to reconcile with Stripe.
3. **No visible user-account link.** Can't tell at a glance whether a Non-Member buyer has a portal account (vs pure guest email).

## Changes

**`src/pages/admin/EventDetail.tsx`**
- Add `Phone` and `Account` columns to the roster (Account = "Portal account" if `user_id` is set, else "Guest checkout").
- Add a "Pending" KPI card next to "Tickets sold" so pending intents are visible.
- Add an "Export CSV" button that downloads the paid roster (name, email, phone, type, amount, purchased-at) for door use.
- Add a small filter: All / Paid / Pending / Refunded.

**No changes** to pricing logic, purchase flow, non-member portal integration, or the confirmation screen — those are already correct and in place.

## Technical notes

- `event_tickets` already has `buyer_phone` and `user_id` columns; no schema change required.
- CSV export can be generated client-side from the existing query result — no new edge function.
- Existing RLS on `event_tickets` allows admins full read; no policy changes.
