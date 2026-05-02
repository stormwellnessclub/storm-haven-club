# Fix Waitlist Promotion (Carly's case)

## What's wrong today

In `src/pages/admin/ClassRoster.tsx`, the **Promote** button on the Waitlist tab does two harmful things:

1. **Always comps the booking.** The promote mutation (lines 287–313) inserts a `class_bookings` row with `payment_method: "comp"` regardless of whether the member has class credits or a class pass. That's why Carly didn't get a credit/pass deducted.
2. **Doesn't recover gracefully.** When you then cancel that comped booking and try to re-add her with credits via the "Add to class" panel, the existing flow gets confused because:
   - The waitlist entry is already marked `claimed` (so she no longer appears in the waitlist tab to be re-promoted).
   - The "Add to class" panel's existence check (lines 338–345) only blocks on `status = 'confirmed'`, so re-add should work — but the UI on the waitlist tab itself offers no alternative payment methods, leaving the admin stuck.

## What we'll change

### 1. Replace the single "Promote" button with a Promote dialog

When the admin clicks **Promote** on a waitlist row, open a small dialog that reuses the existing `PaymentMethodSelector` component (the same one used in the Add panel), pre-loaded with that user's passes and credits.

- Default selection: **Credits** if available, else **Pass** if available, else **Comp** (with a clear "Comp" label so it's an intentional choice, not the default).
- Confirm button runs the same booking insert logic the Add panel uses (decrement pass / credit, set the right `payment_method`, `pass_id` / `member_credit_id`, `credits_used`), then marks the waitlist entry `claimed`.
- All in one mutation so a failure rolls the user back to the waitlist (don't mark `claimed` until the booking insert succeeds).

### 2. Make cancel-then-re-add work

When `removeMutation` cancels a booking that originated from a waitlist promotion, also revert the waitlist entry from `claimed` back to `waiting` (or `notified`) so the admin can promote again with the correct payment method. We'll detect this by joining the most recent waitlist entry for that user/session.

Alternatively (simpler): after cancelling, the admin can use the existing "Add to class" search panel — but today that panel doesn't surface for waitlisted users on the Waitlist tab. Adding the dialog from change #1 is the cleaner fix and avoids needing this fallback.

### 3. Defensive guard

In the new promote dialog, if Credits is selected but the member has zero remaining, the Confirm button is disabled with an inline message ("No class credits available — choose a pass or comp"). Same for Pass.

## Files to edit

- `src/pages/admin/ClassRoster.tsx`
  - Replace the inline `promoteMutation` (lines 287–313) with logic that accepts a `PaymentOption` + selected pass/credit id.
  - Add local state for the promote dialog (`promoteEntry`, `promoteMethod`, `promotePassId`, `promoteCreditId`).
  - Render a `<Dialog>` containing `<PaymentMethodSelector>` wired to the selected waitlist entry's `user_id` / `member_id`.
  - On confirm: run the same pass/credit decrement + booking insert used by `addToClassMutation`, then update the waitlist row to `claimed`.
  - In `removeMutation`, after marking the booking `cancelled`, look up the most recent `claimed` waitlist entry for that user/session and revert it to `waiting`. Best-effort, don't block.

No DB migrations needed — `class_bookings` and `class_waitlist` already support every status and payment method we need.

## Acceptance check

- Promoting Carly with **Credits** selected: booking shows `payment_method = credits`, `member_credit_id` set, `credits_used = 1`; her credit balance drops by 1 and the deduction shows in her credit history.
- Promoting with **Pass** selected: pass `classes_remaining` drops by 1; booking shows `payment_method = pass`, `pass_id` set.
- Cancelling a credit/pass-promoted booking restores the credit/pass (existing `removeMutation` already does this) and re-opens the waitlist entry so the admin can promote again.
- Comp is still available as an explicit choice in the dialog.
