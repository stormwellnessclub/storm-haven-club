

## Enhance Freeze Page with Stripe Subscription Status

### Problem
The member Freeze Request page shows freeze dates and fees, but does not display:
- Whether the Stripe subscription is currently paused during the freeze
- When subscription billing will automatically resume
- The subscription status in the context of a freeze

### Changes

**File: `src/pages/member/FreezeRequest.tsx`**

Add a "Billing During Freeze" info card that appears when a member has an active freeze. This card will:
- Fetch the member's subscription status from Stripe via the existing `stripe-payment` edge function (`get_subscription` action)
- Show that billing is paused (subscription `pause_collection` is active)
- Display the freeze end date as the billing resume date
- Show the subscription status (e.g., "Paused" vs "Active")

**File: `src/components/member/BillingSummary.tsx`**

Add freeze-aware status display:
- Accept an optional `memberStatus` prop
- When the member status is `frozen`, show a "Billing Paused" badge next to the subscription info instead of the normal "Next Payment" date
- Show "Resumes after freeze ends" messaging

### Technical Details

| File | Change |
|------|--------|
| `src/pages/member/FreezeRequest.tsx` | Add a "Billing Status" card when an active freeze exists; fetch subscription data via `stripe-payment` edge function |
| `src/components/member/BillingSummary.tsx` | Accept optional `memberStatus` prop; show "Billing Paused" badge and hide "Next Payment" when status is `frozen` |
| `src/pages/member/Membership.tsx` | Pass `membership.status` to `BillingSummary` component |

No backend or edge function changes needed -- this uses existing infrastructure.

### What Members Will See

When frozen:
- Active freeze alert already shows the freeze end date
- New: A "Billing Status" card showing "Subscription Paused -- No charges during freeze"
- New: "Billing resumes on [freeze end date]" messaging
- The Billing Overview on the Membership page will show "Paused" instead of a next payment date

When not frozen:
- No change to current behavior

