## Goal

Surface upcoming class, spa, and kids care bookings directly on the Book hub (`/member/book` and `/portal/book`) so members can cancel or reschedule without leaving the page.

## Scope

UI-only change. Reuses existing hooks and cancel mutations — no new backend/RPC work.

## New component: `UpcomingBookingsPanel`

Path: `src/components/booking/UpcomingBookingsPanel.tsx`

Reads three existing sources and merges them into a single time-sorted list (next 14 days):

- Classes — `useUserBookings()` (already used in `Bookings.tsx`), filtered to upcoming + not cancelled
- Spa — `useUserSpaAppointments()` from `useSpaBooking.ts`, filtered to `confirmed` + future
- Kids care — `useUserKidsCareBookings()` (already used in `KidsCareBookings.tsx`), filtered to upcoming + not cancelled

Each row shows:
- Icon + type label (Class / Spa / Kids care)
- Title (class name, service name, child name + tier)
- Date + time in `America/Chicago`
- Two inline action buttons: **Cancel** and **Reschedule**

### Cancel action
Opens an `AlertDialog` showing the 24-hour cancellation policy (reuse `CancellationPolicyText`). On confirm:
- Class → `useCancelBooking().mutate(bookingId)`
- Spa → `useCancelSpaAppointment().mutate({ id, reason })` (already in `useSpaBooking.ts`)
- Kids care → `useCancelKidsCareBooking().mutate({ bookingId, reason })`

All three already invalidate the right queries, so the row disappears automatically.

### Reschedule action
Two-step: cancel current booking, then navigate to the matching book page with a query param to hint context:
- Class → cancel, then `navigate('/member/book/class?rescheduleFrom=<id>')`
- Spa → cancel, then `navigate('/spa?rescheduleFrom=<id>')`
- Kids care → cancel, then `navigate('/member/kids-care?rescheduleFrom=<id>')`

The destination pages already exist and don't need to read the param — it's purely informational for now. A small toast ("Original booking cancelled — pick a new time") confirms the flow. This keeps reschedule purely presentational: no new mutations, no atomic swap.

### Empty / loading
- Loading → 2 `Skeleton` rows
- Empty → hide the whole panel (don't take up space when nothing to cancel)

## Hub integration

`src/pages/member/Book.tsx` and `src/pages/portal/Book.tsx`:
- Render `<UpcomingBookingsPanel />` between the header and the tile list.
- Portal version only shows class + spa rows (kids care is member-only) — pass a `scope="portal"` prop that hides kids care.

## Out of scope

- True atomic reschedule (single RPC that swaps slot without releasing credit) — current approach cancels then rebooks, which already refunds the credit/pass via existing cancel hooks.
- Editing notes/attendees inline.
- Admin views.

## Files

Create:
- `src/components/booking/UpcomingBookingsPanel.tsx`

Edit:
- `src/pages/member/Book.tsx` — mount the panel
- `src/pages/portal/Book.tsx` — mount the panel with `scope="portal"`
