## Goal

Allow members **and** non-members to book Red Light Therapy and Dry Cryotherapy on the same day, with a 20-minute minimum notice. Members with available wellness credits use a credit (deducted atomically and shown in their account + credit history); everyone else pays as today.

## Current behavior (why it's broken)

- `SpaBookingModal` hard-codes the earliest selectable date to **tomorrow** (`addDays(new Date(), 1)`) for every spa service.
- The time grid does not filter past times for "today", so even if the calendar allowed today, the user could pick a time in the past.
- The `book_wellness_appointment` RPC works correctly for members — it locks `member_credits`, decrements `credits_remaining`, and writes `credit_id` + `credit_type` onto `spa_appointments`. The member's Credit History page (`/member/credits`) already reads usage from `spa_appointments` by `credit_type`, so the deduction is already visible there. No schema change needed for history.

## Plan

### 1. Same-day booking + 20-minute notice (frontend only for Red Light / Dry Cryo)

In `src/components/booking/SpaBookingModal.tsx`:

- Detect "wellness" services using `getWellnessCreditType(service.name)` (already imported). When non-null (red light or dry cryo), treat the service as **same-day eligible**.
- Replace the single `minDate` constant with a service-aware value:
  - Wellness service → `minDate = startOfDay(today)`
  - All other spa services → keep current `addDays(today, 1)` (next-day rule).
- Default `selectedDate` becomes today for wellness services, tomorrow for others.
- Filter `availableStartTimes` for "today" so only slots whose start is **≥ now + 20 minutes** remain. Implement in `src/lib/spaAvailability.ts` by accepting an optional `minStartTime` ("HH:mm") in `generateAvailableStartTimes` and dropping earlier slots; pass it from the modal only when the selected date is today and the service is a wellness service.
- If the user picks today and no slots remain after the 20-min cutoff, show the existing "no slots" message and the next-available helper.

### 2. Non-members can use the same path

Non-members currently fall through to the `paymentMethod === "card"` branch which calls `charge_saved_card` and requires `members.stripe_customer_id`. For non-members:

- The booking modal already supports `useNonMemberProfile`. We will allow non-members to book wellness same-day by routing them through the existing **`stripe-payment` charge_saved_card** flow against their non-member Stripe customer (already used elsewhere in the portal — we'll mirror what `src/pages/portal/Recovery.tsx` / non-member checkout does). Specifically, when the user has no `members` row, look up `non_member_profiles.stripe_customer_id` and use that. If neither exists, fall back to embedded checkout (the existing non-member flow).
- No DB change needed — `spa_appointments` already accepts `member_id IS NULL` rows.

### 3. Members with credits — credit deduction visibility

Already wired: `book_wellness_appointment` decrements `member_credits.credits_remaining` atomically and stamps `credit_id` + `credit_type` on `spa_appointments`. The member portal's Credit History (`src/pages/member/Credits.tsx` line 71) lists those rows. No code change required, but we will:

- After booking via credit, call `refetchCredits()` (already done) **and** invalidate the `["member-credit-history", memberId]` query so the History page updates immediately.
- Add a small "Used 1 credit · X remaining" toast on success when `paymentMethod === "credit"`.

### 4. Acceptance checks

- Member with red_light credits opens Wellness page → Book → today appears in calendar → only times ≥ now+20min are listed → booking succeeds → `member_credits.credits_remaining` decreases by 1 → appointment shows in `/member/credits` history with "Red Light Therapy" + date.
- Member without credits → same-day still bookable, charged to saved card.
- Non-member → same-day red light/cryo bookable via saved card or embedded checkout.
- Other spa services (massage, facial, etc.) → still require next-day booking (unchanged).

## Files to change

- `src/lib/spaAvailability.ts` — add optional `minStartTime` param to `generateAvailableStartTimes`.
- `src/components/booking/SpaBookingModal.tsx` — service-aware `minDate`, default date, today's 20-min cutoff, non-member same-day card path, query invalidation on credit booking.

## Out of scope

- No DB migration. No changes to `book_wellness_appointment` RPC or to spa_appointments schema.
- Admin-side booking unchanged.