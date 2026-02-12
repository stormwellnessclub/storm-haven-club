

## Fix: Exclude Cancelled Members from "Initiation Due" Count

### Problem
The "Initiation Due (31)" count on the Members page includes cancelled and expired members. Since you've already cancelled all the members who never paid, those 31 are cancelled members still being counted as "unpaid." They're hidden from the table (because cancelled members are hidden by default), but the count badge still shows them, making it look like there's outstanding work to do.

### Solution
Exclude cancelled and expired members from the initiation fee unpaid count (and other billing-related counts like "No Card" and "No Subscription"). These counts should only reflect members who actually need attention.

### Technical Details

**File: `src/pages/admin/Members.tsx`**

Update the counting logic (around lines 285-304) to skip cancelled and expired members for billing-related counts:

```
// Before counting initiation fee, card, and subscription:
const status = member.status?.toLowerCase() || "";
const isTerminated = status === "cancelled" || status === "expired";

// Initiation fee - only count non-terminated members as "unpaid"
if (member.annual_fee_paid_at || member.annual_fee_subscription_id) {
  counts.initiationPaid++;
} else if (!isTerminated) {
  counts.initiationUnpaid++;
}

// Card - only flag missing cards for non-terminated members
if (member.card_last4) {
  counts.hasCard++;
} else if (!isTerminated) {
  counts.noCard++;
}

// Subscription - only flag missing subs for non-terminated members
if (member.stripe_subscription_id) {
  counts.hasSubscription++;
} else if (!isTerminated) {
  counts.noSubscription++;
}
```

This way, the "Initiation Due" badge will only show the count of active/pending/frozen/past_due members who haven't paid -- the ones that actually need your attention.
