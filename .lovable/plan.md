# Buy Event Tickets For Someone Else

Add the ability for a member (or admin, from a member's account) to buy an event ticket as a gift/on behalf of another person, so the recipient's name (and optional email) shows on the event roster instead of the purchaser's.

## Scope

Two entry points get the new behavior:

1. **Member portal** — the existing `BuyTicketsDialog` used from `EventPage` / `PortalUpcomingEvents`.
2. **Admin → Member detail** — a new "Sell Event Ticket" action that charges the member's card on file and lets staff enter an attendee.

Non-member checkout on public event pages is not changed.

## UX

### Member portal (BuyTicketsDialog)
- New toggle: **"These tickets are for someone else"** (off by default).
- When off: current flow — purchaser is the attendee.
- When on and quantity = 1: show **Attendee first name**, **Attendee last name**, **Attendee email (optional)**, **Attendee phone (optional)**. The purchaser's own info (from auth/profile) is still captured as the buyer for receipt + payment.
- When on and quantity > 1: show a small repeating list (one row per ticket) with first/last name, and optional email/phone per attendee. First row prefilled with purchaser name only if they toggle "include me" (default off in gift mode).
- Receipt still emails the purchaser; each attendee with an email also gets the standard event confirmation to their address.

### Admin → MemberDetail
- New **"Sell Event Ticket"** button next to "Sell Gift Card".
- Dialog lists on-sale events (title, date, member price). Staff picks an event, quantity, and per-ticket attendee (name required, email optional). Purchaser defaults to the member; charge goes to their card on file via `stripe-payment` `charge_saved_card_with_3ds` (same pattern as `SellGiftCardDialog`), then calls the finalize path to mark tickets paid and send confirmations. Member rate is applied because the buyer is an active member.

## Data model

Add attendee fields to `event_tickets` (keeps buyer_* as the payer):

```
attendee_first_name  text
attendee_last_name   text
attendee_email       text
attendee_phone       text
is_gift              boolean not null default false
gifted_by_user_id    uuid references auth.users(id) on delete set null
```

Backfill: on existing rows, `attendee_*` stays null and roster/confirmation logic falls back to `buyer_*` (current behavior).

Roster display rule everywhere (`EventDetail` admin roster, `verify-event-ticket` check-in, confirmation email "attendee name"): use `attendee_*` when present, else `buyer_*`. Show a small "Gift" badge on admin roster when `is_gift`.

## Backend changes

### `create-event-ticket-checkout`
- Accept new body: `attendees?: Array<{ first_name: string; last_name: string; email?: string; phone?: string }>` (length must equal `quantity` when provided). Also accept `is_gift?: boolean`.
- Validate: names required per attendee, email optional but must be valid if present.
- When inserting the `qty` pending ticket rows, map each row to its attendee (attendee_first_name/last/email/phone), set `is_gift = true`, and set `gifted_by_user_id = userId` when authed.
- Member-rate detection still uses the **purchaser's** email/user (buyer), not the attendees.
- If `attendees` is omitted, behavior is unchanged.

### `finalize-event-ticket-payment` + `send-event-ticket-confirmation`
- Purchaser receipt goes to `buyer_email` (already does).
- If `attendee_email` is present and differs from `buyer_email`, send the same event confirmation to the attendee too (their name, event details, QR). Reuse the existing template; add a small "You've been gifted a ticket by {buyer name}" line when `is_gift`.

### Verify / check-in (`verify-event-ticket`)
- Return the attendee display name (attendee_* falls back to buyer_*) so front desk sees the correct person.

### New edge function: `admin-sell-event-ticket`
- Auth: admin/manager/front_desk with role check.
- Body: `member_id`, `event_slug`, `quantity`, `attendees[]`, `payment_method_id` (optional; else use member's default card).
- Fetches member, ensures active + card on file, computes total at member price, charges via existing `stripe-payment` `charge_saved_card_with_3ds` (or `manual_charge` for cash if we want later — v1 is card-on-file only), inserts paid tickets tied to the member's `user_id` as buyer with `is_gift=true` and `gifted_by_user_id=<admin's user_id or member user_id>` (member user_id — since it's their purchase), then invokes confirmation emails.

## Files to change

- `supabase/migrations/*` — add columns to `event_tickets`.
- `supabase/functions/create-event-ticket-checkout/index.ts` — accept + persist attendees, is_gift.
- `supabase/functions/finalize-event-ticket-payment/index.ts` — trigger attendee emails.
- `supabase/functions/send-event-ticket-confirmation/index.ts` — accept target address + attendee name; add gifter line.
- `supabase/functions/verify-event-ticket/index.ts` — return effective attendee name.
- `supabase/functions/admin-sell-event-ticket/index.ts` — new.
- `src/components/events/BuyTicketsDialog.tsx` — "For someone else" toggle + per-ticket attendee rows.
- `src/pages/admin/EventDetail.tsx` — roster shows attendee name and Gift badge.
- `src/components/admin/SellEventTicketDialog.tsx` — new admin dialog.
- `src/pages/admin/MemberDetail.tsx` — button to open the new dialog.
- `src/integrations/supabase/types.ts` — regen after migration.

## Out of scope (v1)

- Transferring an already-purchased ticket to a different person.
- Splitting one purchase across mixed member/non-member rates.
- Scheduling a future "reveal" email like gift cards.

Confirm and I'll build it.
