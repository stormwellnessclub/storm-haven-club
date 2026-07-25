## 1. Fix "edge function failed" on Sell Event Ticket

`admin-sell-event-ticket` exists in source but returns 404 — never deployed. Force a redeploy via `supabase--deploy_edge_functions`. No code changes.

## 2. Add Events roster view for Front Desk (read-only)

**New page** `src/pages/frontdesk/Events.tsx` at `/frontdesk/events`:
- Lists ticketed events (`on_sale`, `announced`, `sold_out`) with title, date/time, venue, sold/capacity.
- Click an event to expand roster showing every paid ticket:
  - Attendee name (falls back to buyer name if not a gift)
  - Badge: **Member** (blue) or **Non-Member** (grey), from `ticket_type`
  - **Gift** tag with buyer name when `is_gift = true`
  - Check-in status (checked in / not yet)
- View-only — no refund, edit, or resend actions.

**Nav entry** added to `NAV` array in `src/pages/frontdesk/FrontDeskShell.tsx` (Ticket icon, between Schedule and POS).

**Route** added in `src/App.tsx` alongside the other `/frontdesk/*` routes.

**Data access:** reuses `events` and `event_tickets`. I'll verify the existing `event_tickets` SELECT policy already permits `front_desk`; if not, I'll add a small policy in a migration in the same turn.

## Files touched

- `supabase/functions/admin-sell-event-ticket/index.ts` — redeploy only
- `src/pages/frontdesk/Events.tsx` — new
- `src/pages/frontdesk/FrontDeskShell.tsx` — nav entry
- `src/App.tsx` — route
- Optional migration if front_desk lacks SELECT on `event_tickets`
