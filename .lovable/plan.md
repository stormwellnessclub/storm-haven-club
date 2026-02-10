

## Cash-Paid-Ahead Membership with Future Stripe Subscription

The core problem: Farah Hakim paid cash for a full year of dues, but the system can't handle this scenario because:
1. The subscription creation dialog limits the "First Charge Date" to 90 days in the future max
2. There's no explicit "Cash Paid Ahead" workflow that activates the member now and defers Stripe billing to when the cash period expires (e.g., 1 year out)

---

### What Will Change

**1. Extend Date Range in CreateSubscriptionDialog**

The "First Charge Date" calendar currently caps at 90 days. We'll extend it to **18 months** (548 days) to allow scheduling the first Stripe charge well into the future -- covering a full year paid ahead plus buffer.

**2. Add a "Cash Paid Ahead" Quick Option**

Inside the "When should the first payment occur?" section, add a radio toggle:
- **Charge Now** (default) -- existing behavior
- **Cash Paid Ahead** -- pre-selects "1 year from today" as the first charge date, with the ability to adjust

This makes it a one-click workflow: select "Cash Paid Ahead", confirm the date, and the system will:
- Create the Stripe subscription immediately (so card is on file for future billing)
- Use `billing_cycle_anchor` set to the future date (no charge today)
- Activate the member now with full benefits

**3. Update Edge Function Date Validation**

The `admin_create_member_subscription` action in `stripe-payment` already supports `firstChargeDate` and future `billing_cycle_anchor`. No logic changes needed there -- it already handles future dates correctly. We just need to ensure the frontend passes the extended date.

**4. Add Visual Confirmation for Long Deferrals**

When the first charge date is more than 90 days out, show a clear summary:
- "Member paid cash through [date]. First Stripe charge: [date]."
- Highlight that the member will be active immediately with full benefits.

---

### Technical Details

| File | Changes |
|------|---------|
| `src/components/admin/CreateSubscriptionDialog.tsx` | Extend `maxDate` for charge date to 548 days (18 months). Add "Cash Paid Ahead" radio option that pre-fills 1 year out. Add enhanced summary for long deferrals. |
| No backend changes needed | The edge function already supports arbitrary future `firstChargeDate` via `billing_cycle_anchor`. |

### How It Solves Farah's Case

1. Go to Farah's Member Detail page
2. Click "Create Subscription"
3. Set Benefits Start Date to today (or Feb 9)
4. Select "Cash Paid Ahead" -- first charge auto-sets to 1 year from start
5. Confirm -- Farah is activated immediately, card on file for next year's billing

