## The bug

When you add someone to tomorrow's donation class from the admin class roster, the "Charge single drop-in" option shows **Member $25 / Non-Member $30** — the standard rates — instead of the fundraiser donation amount.

The public booking modal already handles this correctly: it reads `session.is_fundraiser` + `session.override_price_cents` and replaces the credits/pass/drop-in panel with a single "Donate $X & Reserve" button. The admin roster (`/admin/class-roster/...`) was never updated to match — it always shows the hardcoded $25/$30 rates and charges those amounts on save.

## The fix

Pass the session's fundraiser context into the roster's payment selector and charge logic so donation classes behave correctly when admins book people in.

### Files to change

**`src/components/admin/roster/PaymentMethodSelector.tsx`**
- Accept two new props: `isFundraiser: boolean` and `fundraiserAmountCents: number`.
- When `isFundraiser` is true:
  - Hide the **member credits** and **class pass** options entirely (matches public booking — credits/passes can't be used on fundraiser classes).
  - Replace the "Charge single drop-in" panel with a single **"Charge donation — $X"** panel (no Member/Non-Member toggle). Keep the same `"dropin"` payment option value so downstream logic stays simple.
  - Keep **Comp / No charge** available (admin override).
  - Keep **Sell a package** hidden or disabled (it doesn't apply to a donation class).

**`src/pages/admin/ClassRoster.tsx`**
- Read `is_fundraiser` and `override_price_cents` from the session query (add to the select if not already present).
- Pass `isFundraiser` and `fundraiserAmountCents` into both `<PaymentMethodSelector>` mount points (the add-to-class form and the waitlist-promote form).
- In `addToClassMutation` and `promoteFromWaitlistMutation`, when `paymentMethod === "dropin"` AND the session is a fundraiser:
  - Use `override_price_cents` (fallback 4000 = $40) as the amount instead of `dropInRate === "member" ? 2500 : 3000`.
  - Set `payment_method: "fundraiser"` (or keep `"walk_in"` but tag the booking — pick whichever matches existing reporting; will confirm by checking how the public fundraiser checkout records its booking).
  - Pass a descriptive string to `charge_saved_card` (e.g. `"Donation: <class name> on <date> — <beneficiary>"`).
- When auto-selecting default payment method on a fundraiser session, default to `"dropin"` (donation) instead of pass/credits.

### Out of scope

- No DB schema changes — `is_fundraiser`, `override_price_cents`, and `fundraiser_beneficiary` already exist on `class_sessions`.
- No changes to the public booking flow (already correct).
- No changes to Stripe products/prices.

### How you'll verify

Open the admin roster for tomorrow's donation class → click **Add to class** → the payment section should show **"Charge donation — $40"** (or whatever override amount is set) instead of the $25/$30 toggle, and credits/passes should be hidden. Save → booking is created at the donation amount, member's card on file is charged that amount.
