

# Fix: Revenue Report Counting Non-Paying Members

## Problem

The **Revenue Summary Report** queries members with `status = 'active'` but that alone is not enough. Many members may have `status = 'active'` in the database while their `subscription_status` is `incomplete`, `past_due`, `canceled`, etc. — or they may have no Stripe subscription at all. The "Active Members" card shows the total count of all `status = 'active'` members (160), inflating the number.

The regular member revenue filter (`subscription_status === 'active'`) already excludes non-paying regulars from the **revenue calculation**, but:
1. The **"Active Members" count** still shows all 160 (including non-paying)
2. **Founding members** are counted without any subscription validation
3. The query doesn't exclude members with no `stripe_subscription_id` (who may be old applications that got set to 'active' without ever paying)

## Fix

**File: `src/components/admin/reports/reports/RevenueSummaryReport.tsx`**

1. Add `stripe_subscription_id` to the select query
2. Change the "Active Members" card to show only **paying** members (founding + regular with active subscription)
3. For founding members, keep counting all (they paid annually upfront)
4. For regular members, require `subscription_status = 'active'` AND a valid `stripe_subscription_id`
5. Add a note showing how many non-paying members were excluded

Also add `billing_type` to handle cash-billing members correctly (they don't need a Stripe subscription).

**File: `src/components/admin/reports/reports/MemberStatusReport.tsx`**

This report intentionally shows all statuses — no change needed here (it's a status breakdown report). But the "Active / Paying Members" label should clarify it means `status = 'active'`, not necessarily paying.

This is a single-file change to `RevenueSummaryReport.tsx` — updating the query select fields and the member counting/display logic.

