# Event attendees: add, remove, and fix "release my place"

## 1. The release-seat error (confirmed cause)

When a member presses "Release my place", the club saves their spot with the word
"abandoned". The events table only accepts pending, paid, refunded or cancelled — so the
save is rejected and the member sees an error. Their place is never released.

Fix: release now records the place as **cancelled** (with the reason stored separately),
so it works. Two related improvements:

- The release also looks the member up by email, not only by their login, so places
  created by staff on their behalf can still be released.
- Clearer messages instead of one generic failure: a paid ticket tells the member to
  contact the club for a refund rather than silently failing.

Any places already stuck from this bug will be checked and corrected.

## 2. Staff can add anyone to an event

On the event page in the Events Portal (Events Portal → event → Reservations), a new
**Add someone** button opens a panel with:

- A search across members, non-members and any account (same search used elsewhere at the
  front desk), showing who is a member.
- A "not in the system" option: first name, last name, email, phone typed in directly.
- Choice of Member or Guest, and how it is being recorded: complimentary (no charge),
  or already paid elsewhere (cash / Clover / other, with a reference note).
- An **Override** switch for managers to seat someone past capacity or outside the
  membership level the event is normally held for. The reason is recorded.
- Optional "send them the confirmation email" checkbox, off by default.

## 3. Staff can remove someone

Each row in the Reservations list gets a **Remove** action with a confirmation step:
who is being removed, and a required short reason. The place is marked cancelled (never
deleted), frees capacity immediately, and is written to the event's history. Removing
someone optionally notifies the waitlist as it does today.

## Technical notes

- New migration:
  - Widen `event_tickets.status` check to include `cancelled` usage already present; keep
    `abandoned` out. Update `cancel_event_reservation` to set `status = 'cancelled'`,
    `abandon_reason = 'member_cancelled'`, and to match on `user_id` OR
    `lower(buyer_email) = current_user_email_lower()`, mirroring
    `get_event_member_state`. Backfill any rows with an invalid status.
  - New `admin_add_event_attendee(_event_id, _first, _last, _email, _phone, _user_id,
    _ticket_type, _amount_cents, _payment_note, _override, _override_reason)` —
    SECURITY DEFINER, guarded by `has_any_role(auth.uid(), ...)` for
    super_admin/admin/manager/front_desk; capacity + eligibility enforced unless
    `_override` (manager roles only) with a required reason; inserts a `paid` ticket.
  - New `admin_remove_event_attendee(_ticket_id, _reason)` — same role guard; sets
    `status = 'cancelled'`, `abandon_reason`, `abandoned_at`.
  - Both log to the existing event activity/audit path used by the portal.
- Frontend:
  - `src/pages/eventsportal/EventsPortalEventDetail.tsx` — Add someone dialog + Remove
    action on each row; invalidates `events-portal-tickets`.
  - New `src/components/eventsportal/AddEventAttendeeDialog.tsx`, reusing
    `src/components/admin/roster/PersonSearch.tsx`.
  - `src/components/events/MemberEventActions.tsx` — reason-specific release messages.
- Confirmation email reuses `send-event-reservation-email`; no new function needed.
