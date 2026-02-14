

## Complimentary Guest Pass: Admin-Triggered with Dues-Paid Filter + Remove Feature

### What Changes

Update the existing "Send Guest Pass Promo" button on the Admin Guest Passes page to only grant complimentary credits to members who are fully paid and properly activated. Also add a "Revoke Guest Pass Credits" button to undo mistakes.

### Eligibility Rules

A member qualifies for the complimentary guest pass credit only if ALL of these are true:

| Condition | How it's checked |
|-----------|-----------------|
| Status is `active` | `status = 'active'` |
| Membership has been activated | `activated_at IS NOT NULL` |
| Initiation fee is paid | `annual_fee_paid_at IS NOT NULL` OR `annual_fee_subscription_id IS NOT NULL` |
| Subscription is current | `subscription_status IN ('active', 'trialing')` OR `billing_type = 'cash'` |

Members who are marked `active` but haven't completed activation or payment will be skipped.

### New "Revoke" Button

A second button next to "Send Guest Pass Promo" labeled "Revoke Guest Pass Credits" that:
- Finds all non-expired `guest_pass` credits with `credits_remaining > 0`
- Sets `credits_remaining` to 0 for all of them
- Shows a confirmation dialog first ("This will revoke all unused complimentary guest pass credits. Continue?")
- Shows success count

### Changes

| File | What |
|------|------|
| `src/pages/admin/GuestPasses.tsx` | Update the member query in `handleSendPromo` to add eligibility filters; add a new `handleRevokeCredits` function and "Revoke" button |

### Technical Details

**File: `src/pages/admin/GuestPasses.tsx`**

1. **Update member query** (around line 627): Change from `.eq("status", "active")` to also select `activated_at`, `annual_fee_paid_at`, `annual_fee_subscription_id`, `subscription_status`, and `billing_type`. Then filter in the loop to skip members who don't meet all eligibility criteria.

2. **Add eligibility check** inside the member loop (around line 652): Before inserting a credit, verify the member has `activated_at` set, initiation fee paid (either `annual_fee_paid_at` or `annual_fee_subscription_id`), and current subscription (`subscription_status` in `active`/`trialing` or `billing_type` is `cash`). Skip and increment a "skipped" counter for ineligible members.

3. **Update confirmation dialog** (line 622): Change text to "This will allocate 1 complimentary guest pass credit to every active member with all dues paid. Members without full activation or payment will be skipped. Continue?"

4. **Update success toast** (line 703): Include skip count, e.g., "Guest pass promo sent! X credits allocated, Y skipped (ineligible), Z errors"

5. **Add revoke function and button**: New `handleRevokeCredits` async function that queries `member_credits` where `credit_type = 'guest_pass'`, `credits_remaining > 0`, and `expires_at > now()`, then updates all matching records to set `credits_remaining = 0`. Add a "Revoke Guest Pass Credits" button (destructive variant) next to the existing promo button.

No database changes needed. No new files.
