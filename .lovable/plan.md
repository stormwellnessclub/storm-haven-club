# Front Desk: first-time-to-club vs first-time-as-member

## What exists today

- `kiosk_check_in_member` RPC returns `is_first_visit = true` only when the member has **zero prior `check_ins` rows**.
- `FrontDesk.tsx` shows a "⭐ 1st Visit" badge + celebration dialog and calls `mark_first_visit_tour_offered`.
- Problem: a member who visited before as a guest, class-pass drop-in, or non-member is treated like a normal returning check-in, so the front desk never gets prompted to give them a member tour.

## What the user wants

Two distinct signals surfaced at check-in:

1. **First time ever at the club** — no prior activity of any kind.
2. **First time here as a member** — has prior activity (guest pass, class pass, non-member visit, spa appt, cafe order, etc.) under the same email, but this is the first check-in since their membership activated.

Front desk should get a clear popup + persistent badge for **either** case, with wording that tells them which one, so they know to offer a tour + membership walkthrough.

## Plan

### 1. Database — extend `kiosk_check_in_member`

Add a new `first_visit_kind` field to the RPC response:

- `'first_ever'` — no prior `check_ins` **and** no prior guest_pass / class_pass / non_member_profile / spa_appointment / cafe_order rows matching the member's email.
- `'first_as_member'` — no prior `check_ins` for this `member_id`, but prior activity exists under the same email (guest pass, class pass, non-member profile, spa appt, etc.).
- `'returning'` — has prior check-ins.

Keep `is_first_visit` boolean for backward compat: true when kind is `first_ever` **or** `first_as_member`. Store the kind in the `check_ins.notes` field ("First club visit" / "First visit as member" / "Kiosk check-in") so history is auditable.

Signal for "prior activity under same email" — check for at least one row in any of:
- `guest_passes` where `guest_email = members.email`
- `class_passes` where `user_id = members.user_id` OR pending_class_pass_checkouts by email
- `non_member_profiles` where `email = members.email`
- `spa_appointments` where `customer_email = members.email`
- `cafe_orders` where `customer_email = members.email`

(Confirm exact column names when implementing — schema may vary; use whichever email column each table actually has.)

### 2. Frontend — `src/pages/FrontDesk.tsx`

- Extend `KioskCheckInResult` (in `useKioskCheckIn.ts`) with `first_visit_kind?: 'first_ever' | 'first_as_member' | 'returning'`.
- Replace the current single celebration dialog with a variant that reads:
  - **first_ever**: "🎉 First time at Storm! Offer a full club tour."
  - **first_as_member**: "⭐ First visit as a member! Offer the member walkthrough (app, credits, booking)."
- Update the roster badge next to the name:
  - `⭐ 1st Visit` (first_ever) — gold
  - `🆕 New Member` (first_as_member) — blue
- Both dismiss via existing `mark_first_visit_tour_offered` RPC (no schema change to tracking).

### 3. Kiosk attendance list

`useKioskAttendance.ts` currently infers `is_first_visit` from `notes.startsWith("first club visit")`. Extend it to also flag `first_as_member` when notes start with "First visit as member" and pass a `first_visit_kind` field so the roster shows the right badge for today's list.

## Out of scope

- No changes to guest/class/spa check-in flows.
- No changes to `mark_first_visit_tour_offered` — it just marks the prompt as offered regardless of kind.

## Verification

1. Brand-new member (no prior anything) checks in → gold "1st Visit" badge + "First time at Storm" dialog.
2. Member whose email previously bought a guest pass or class drop-in checks in → blue "New Member" badge + "First visit as a member" dialog.
3. Returning member → no badge, no dialog.
4. Second check-in same day for any of the above → no dialog (already_in path).
