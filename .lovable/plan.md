

## Add "First Month Paid in Cash" Option to Create Subscription Dialog

### What This Does
Adds a new radio option called **"First month paid in cash"** to the Create Subscription dialog. When selected, it automatically sets the first Stripe charge date to 1 month after the start date -- so the member's first month is covered by their cash payment, and Stripe billing kicks in for month 2 onward.

### How It Works
1. You open the Create Subscription dialog for any member
2. Under "When should the first payment occur?" you'll see a new option: **"First month paid in cash"**
3. Selecting it auto-calculates the first charge date as ~30 days from the subscription start date
4. The summary shows that cash covers month 1, and the first Stripe charge happens on the calculated date
5. You can still adjust the charge date if needed

### Payment Options After This Change
- **Charge now** -- card charged today (existing)
- **First month paid in cash** -- first charge ~1 month out (NEW)
- **Cash paid ahead (1 year)** -- first charge ~1 year out (existing)
- **Schedule for a specific date** -- pick any future date (existing)

### Technical Details

**File:** `src/components/admin/CreateSubscriptionDialog.tsx`

1. Add `"cash_first_month"` to the `paymentMode` state type
2. Add a new radio option between "Charge now" and "Cash paid ahead (1 year)" with label "First month paid in cash" and a Banknote icon
3. When selected, auto-set `firstChargeDate` to `addDays(startDate, 30)` (or use `addMonths` from date-fns for calendar-month accuracy)
4. Show a date picker so the admin can adjust if needed, pre-filled with the calculated date
5. Update the summary section and button labels to handle the new mode
6. Update `isCashPaidAhead` logic to also recognize this mode for the summary display

No backend changes needed -- the `onConfirm(startDate, firstChargeDate)` signature already supports deferred charge dates.

