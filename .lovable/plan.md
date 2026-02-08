

## Plan: Flexible Date Selection for Activation & Initiation Fee

### Problem Summary
Currently, you cannot:
1. Pick a past date (like Feb 6th) when activating members - dates are restricted to today and future only
2. Pick a specific date when charging/creating initiation fee subscriptions - it always uses today's date
3. Specify a custom billing anchor date for initiation fees

### Solution Overview

Add flexible date pickers to all relevant dialogs, allowing:
- **Past dates** (up to 30 days back) for backdating
- **Future dates** (up to 90 days out)
- Clear warnings when selecting past dates about billing implications

---

### Components to Update

| Component | Current Behavior | New Behavior |
|-----------|-----------------|--------------|
| `SingleActivationDialog.tsx` | Today → 30/90 days only | -30 days → +90 days |
| `InitiationFeeChargeDialog.tsx` | No date picker, charges immediately | Add date picker, allow backdated subscriptions |
| `CreateInitiationFeeSubscriptionDialog.tsx` | First charge = 1 year from today | Add date picker for custom billing anchor |
| `BatchActivationDialog.tsx` | Today → 30 days | -30 days → +30 days |

---

### Detailed Changes

#### 1. SingleActivationDialog.tsx

**Current code (line 80-82):**
```typescript
const isDateDisabled = (date: Date) => {
  return date < today || date > maxDate;
};
```

**Updated code:**
```typescript
const minDate = addDays(today, -30); // Allow 30 days back
const isDateDisabled = (date: Date) => {
  return date < minDate || date > maxDate;
};
```

**Add warning alert when past date selected:**
```typescript
{startDate && startDate < today && (
  <Alert className="bg-amber-50 border-amber-200">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <AlertDescription>
      <strong>Past date selected.</strong> Membership will be backdated to {format(startDate, 'MMM d')}. 
      Subscription billing will be calculated from this date.
    </AlertDescription>
  </Alert>
)}
```

---

#### 2. InitiationFeeChargeDialog.tsx

**Add date picker for subscription start:**

```typescript
// New state
const [startDate, setStartDate] = useState<Date>(new Date());
const [calendarOpen, setCalendarOpen] = useState(false);

// Date range: -30 days to +90 days
const today = new Date();
const minDate = addDays(today, -30);
const maxDate = addDays(today, 90);
```

**Update subscription creation to use selected date:**
- If date is past: Start subscription immediately, record `original_start_date` in metadata
- If date is today: Normal behavior
- If date is future: Use `billing_cycle_anchor` to start on that date

**UI addition:**
```text
┌────────────────────────────────────────────┐
│ Subscription Start Date                    │
│ [📅 February 6, 2026        ▼]            │
│                                            │
│ ⚠️ Past date - subscription backdated     │
└────────────────────────────────────────────┘
```

---

#### 3. CreateInitiationFeeSubscriptionDialog.tsx

**Add date picker for "original payment date":**

This dialog is for members who already paid. Currently it just sets billing anchor to 1 year from today. With a date picker:
- Admin can specify the actual date the initiation fee was originally paid
- Billing anchor is set to 1 year from that date (not from today)

**Example:** If member paid on Feb 6, 2026, the renewal will be Feb 6, 2027.

```typescript
// New state
const [originalPaymentDate, setOriginalPaymentDate] = useState<Date>(new Date());

// Calculate next billing from original payment date
const nextBillingDate = addYears(originalPaymentDate, 1);
```

---

#### 4. BatchActivationDialog.tsx

Apply the same -30 days flexibility for batch activations.

---

### Edge Function Updates

**stripe-payment/index.ts - `admin_create_initiation_fee_subscription`:**

Accept new `startDate` parameter:
- If past date: Create subscription immediately, store `original_start_date` in metadata
- If future date: Use `billing_cycle_anchor`

```typescript
const { memberId, startDate } = body;

// Parse start date
const subscriptionStart = startDate ? new Date(startDate) : new Date();
const now = new Date();

// If start date is in the past, subscription starts now but we record the backdated date
if (subscriptionStart < now) {
  // Create immediately, no anchor
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      original_start_date: subscriptionStart.toISOString(),
      backdated: 'true',
    },
  });
} else if (subscriptionStart > now) {
  // Future date - use billing anchor
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    billing_cycle_anchor: Math.floor(subscriptionStart.getTime() / 1000),
  });
}
```

---

### Post-Activation Editing

Already available at:
**Admin → Members → [Member] → Contract Tab**

The Start Date field is editable - changes save directly to the database. No additional changes needed here.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/SingleActivationDialog.tsx` | Allow -30 days, add backdating warning |
| `src/components/admin/BatchActivationDialog.tsx` | Allow -30 days, add backdating warning |
| `src/components/admin/InitiationFeeChargeDialog.tsx` | Add date picker, pass date to edge function |
| `src/components/admin/CreateInitiationFeeSubscriptionDialog.tsx` | Add original payment date picker |
| `supabase/functions/stripe-payment/index.ts` | Handle startDate parameter in initiation fee actions |

---

### Summary

After implementation, you'll be able to:

1. **Membership Activation**: Pick any date from -30 days to +90 days, with clear warnings for past dates
2. **Initiation Fee Charge**: Pick the billing start date (same range), with backdating support
3. **Initiation Fee Subscription (no charge)**: Specify when the original payment was made, so renewal aligns correctly
4. **Edit after activation**: Already works in the Contract tab

