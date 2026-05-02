# Charge for waitlist spots up front

## Problem

Right now `useJoinWaitlist` (in `src/hooks/useWaitlist.ts`) just inserts a `class_waitlist` row with no payment tied to it. So:

- Members/non-members can sit on the waitlist without holding a credit or pass.
- When admins promote someone (or the auto-promote/notify flow runs), there's no payment context, so admins forget to charge and the booking ends up comped (Carly's case).
- The Schedule "Join Waitlist" button skips the booking modal's payment step entirely.

The project memory (`mem://features/classes/waitlist-system`) actually already states the intended behavior: *"users prepay by selecting a credit or pass (held immediately) when joining. If a spot opens, the system automatically books the user… If they don't get off the waitlist or voluntarily leave, the credit/pass is automatically refunded."* That spec was never fully implemented — this plan finishes it.

## Solution overview

Treat joining the waitlist exactly like a hold: pick a payment method up front, decrement the credit/pass immediately, and remember which one was held on the waitlist row. On promotion, attach that same credit/pass to the booking. On removal/expiry, refund it.

### 1. Schema — add payment hold fields to `class_waitlist`

Add nullable columns so we can carry the held payment forward:

- `payment_method text` — `'credits' | 'pass' | 'dropin' | 'comp'`
- `pass_id uuid` (FK `class_passes.id`)
- `member_credit_id uuid` (FK `member_credits.id`)
- `credits_used int default 0`
- `amount_paid numeric` (for future drop-in waitlist; phase 2)

Phase 1 supports **credits** and **pass** holds (the realistic cases). Drop-in/Stripe waitlist holds are explicitly out of scope — if a user has neither credit nor pass, "Join Waitlist" stays disabled with a message to buy a pass first.

### 2. Member-facing: Join Waitlist flow (`src/components/booking/BookingModal.tsx`)

When a class is full and the user clicks Join Waitlist:

- Reuse `PaymentMethodSelector` (members and non-members both have it on the same modal already — the modal already loads the user's passes/credits for the regular booking flow).
- Require the user to pick **Credits** (if they have any) or **Pass** (if they have any) before the Join Waitlist button enables.
- On submit, run a new RPC `join_waitlist_with_hold(p_session_id, p_method, p_pass_id, p_credit_id)` (SECURITY DEFINER) that:
  1. Re-checks the class is actually full.
  2. Decrements the chosen credit/pass atomically.
  3. Inserts the `class_waitlist` row with `position = next_position`, `status = 'waiting'`, plus the held payment fields.
  4. Returns `{ position, hold_summary }`.
- Toast: "You're #N on the waitlist. We've held 1 [credit/pass] — it'll be refunded if you leave or the spot doesn't open."

Update `useJoinWaitlist` to call this RPC and accept the payment selection as args.

### 3. Schedule page button (`src/pages/Schedule.tsx`)

The current "Join Waitlist" button on the schedule list opens `BookingModal`, which then shows the waitlist UI — that flow is fine, just needs the new payment selector inside the modal's waitlist panel.

### 4. Promotion — auto-attach the held payment

Two promotion paths need to use the held payment instead of comping:

**a. Member self-claim** (`src/hooks/useBooking.ts`, lines 273-292): When a `notified` waitlist entry exists and the user books, read the held `payment_method` / `pass_id` / `member_credit_id` from the waitlist row and set them on the `class_bookings` insert. Do **not** decrement again — the hold already happened on join.

**b. Admin promote dialog** (`src/pages/admin/ClassRoster.tsx`): The new dialog we just built lets admins pick a method. Change it to **default to whatever was held** on the waitlist entry (and disable changing it unless the admin explicitly toggles "override held payment"). If they override, refund the held credit/pass and apply the new one — same primitives we already use.

### 5. Refund on leave or expiry

Anywhere a waitlist entry stops being eligible for a spot, restore the held credit/pass:

- `useWaitlist` leave action (member-facing) — to add: a "Leave waitlist" button on the modal when `isOnWaitlist`. On click, refund the hold and delete/cancel the entry.
- `removeWaitlistMutation` in `ClassRoster.tsx` — refund the held payment before delete.
- `process-expired-waitlist` edge function — when status flips to `expired`, refund the held payment.
- `notify-waitlist` flow when a user is **promoted** in admin without using the held payment (override) — the override path handles its own refund.

Centralize the refund as an RPC `refund_waitlist_hold(p_waitlist_id)` so all four call sites stay consistent.

### 6. UI surfaces for the hold

- Member portal Credits page (`src/pages/member/Credits.tsx`) and pass usage history: add a row type "Held for waitlist — Class X on date" so members see why their balance dropped. Refund shows as a corresponding credit/pass increment with note.
- Admin Class Roster waitlist tab: render a small badge on each waitlist row showing the held payment ("Credit held" / "10-Pack pass held") so the admin knows it's already paid.

## Files to change

- `supabase/migrations/...` (new) — add columns to `class_waitlist`; create `join_waitlist_with_hold` and `refund_waitlist_hold` RPCs.
- `src/hooks/useWaitlist.ts` — `useJoinWaitlist` takes a payment selection; new `useLeaveWaitlist` calls refund RPC.
- `src/components/booking/BookingModal.tsx` — payment selector inside the waitlist join panel; Leave Waitlist button.
- `src/hooks/useBooking.ts` — when claiming from `notified`, copy held payment onto booking and skip the second decrement.
- `src/pages/admin/ClassRoster.tsx` — promote dialog defaults to held payment; remove flow refunds the hold; small "held" badge in waitlist list.
- `supabase/functions/process-expired-waitlist/index.ts` — call `refund_waitlist_hold` on expiry.
- `src/pages/member/Credits.tsx` (and pass history view, if separate) — show "Held for waitlist" entries.

## Acceptance check

- Joining the waitlist with no credits/passes shows a clear "Buy a pass to join the waitlist" message, button stays disabled.
- Joining with credits selected: balance immediately drops by 1, waitlist row stores `payment_method='credits'` + `member_credit_id`.
- Auto-promotion (notified → user claims): booking is created with `payment_method='credits'`, `credits_used=1`, no double-charge.
- Admin promotes someone manually: dialog shows "Held: 1 class credit" by default; confirming uses that hold without re-decrementing.
- Member clicks "Leave waitlist" or entry expires: 1 credit returns to their balance and the credit history shows the refund.
- Carly's scenario: she joins → 1 pass held; admin adds her from the waitlist → booking shows `payment_method='pass'`, pass already decremented, no comp.
