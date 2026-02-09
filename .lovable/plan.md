
## Payment Status Visibility & Enforcement Plan

### Problem Summary
Members with failed payments are showing as "Active" in the system, which can confuse staff and allow members who haven't paid to access the club. The root cause is a disconnect between Stripe payment status and what staff see in the admin UI.

### Specific Issues Found
1. Members like Kinda Turaani, Deana Boussi, and Jacquelyne Olson have subscriptions that may have failed payments, but their displayed status doesn't clearly communicate this to staff
2. The webhook handler only updates status to `past_due` when the member is already `active` - pending activation members with failed payments are not flagged
3. Staff see database status badges ("Active") without seeing payment health indicators inline

---

### Solution: Dual Status Display System

We'll implement an "Effective Status" system that shows staff what really matters - can this member access the club?

---

### Part 1: Backend Webhook Improvements

**File:** `supabase/functions/stripe-webhook/index.ts`

**Changes:**
- Remove the condition that only updates status for `active` members
- Also check `annual_fee_subscription_id` when looking up members for payment failed events
- Improve error logging to show actual error messages (not `[object Object]`)
- Add proper handling for subscription payment failures regardless of current member status

---

### Part 2: New "Effective Status" Badge Component

**File:** `src/components/admin/EffectiveStatusBadge.tsx` (new file)

**Purpose:** Display a single, clear status badge that combines:
- Database status (active, pending_activation, frozen, etc.)
- Payment health (missing subscription, failed payments, missing card)

**Status Display Priority:**
1. **🔴 Payment Failed** - If there are recent failed payments
2. **🔴 No Subscription** - Active member without stripe_subscription_id
3. **🔴 No Card** - Active member without payment method
4. **🟡 Pending Activation** - Awaiting first payment
5. **🔵 Frozen** - Membership on hold
6. **🟢 Active** - All good, can check in
7. **⚫ Cancelled/Expired** - Membership ended

---

### Part 3: Update Member List Display

**File:** `src/pages/admin/Members.tsx`

**Changes:**
- Replace simple status badge with new EffectiveStatusBadge
- Add clear visual distinction between "Active (Good)" and "Active (Issues)"
- Show billing issues inline in the table row

---

### Part 4: Update Check-In Page

**File:** `src/pages/admin/CheckIn.tsx`

**Changes:**
- Use EffectiveStatusBadge for member status display
- Add prominent warning banner when member has payment issues
- Staff message: "This member has payment issues. Check with a manager before allowing access."

---

### Part 5: Update Scanner Display

**File:** `src/pages/admin/Scanner.tsx`

**Changes:**
- Use EffectiveStatusBadge in scan results
- Add clear denial reasons for payment-related access denials
- Show specific issue: "Payment Failed", "No Active Subscription", etc.

---

### Part 6: Update Member Detail Sheet

**File:** `src/components/admin/MemberDetailSheet.tsx`

**Changes:**
- Add prominent payment status section at top of detail view
- Show billing health summary with clear action items
- Add "Sync with Stripe" button to refresh payment status

---

### Part 7: Database Function Update

**Database Migration**

Update `process_member_scan` function to:
- Check recent payment_attempts for failed payments
- Return specific denial reasons for different payment issues
- Log detailed payment status in scanner_access_logs

---

### Technical Details

**New EffectiveStatusBadge Component Logic:**
```text
function getEffectiveStatus(member, billingIssues):
  if member.status === 'cancelled' or 'expired':
    return { status: 'cancelled', canCheckIn: false }
  
  if member.status === 'frozen':
    return { status: 'frozen', canCheckIn: false }
  
  if member.status === 'pending_activation':
    return { status: 'pending_activation', canCheckIn: false }
  
  // Member is "active" in database - check payment health
  issues = billingIssues[member.id] || []
  
  if issues.has('failed_payment'):
    return { status: 'payment_failed', canCheckIn: false }
  
  if issues.has('missing_subscription'):
    return { status: 'no_subscription', canCheckIn: false }
  
  if issues.has('missing_payment_method'):
    return { status: 'no_card', canCheckIn: false }
  
  return { status: 'active', canCheckIn: true }
```

---

### Staff-Facing Changes

**Member List:**
- Status column will show effective status with color coding
- Red for any access-blocking issues
- Green only for fully paid, active members

**Check-In Screen:**
- Large, clear status indicator
- Payment issues shown prominently before check-in button
- Override option with reason logging

**Scanner:**
- Clear "Access Denied" with specific reason
- Payment-related denials get special messaging
- Staff instructions on what to do

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Fix payment failed handler to update all member statuses |
| `src/components/admin/EffectiveStatusBadge.tsx` | New component for unified status display |
| `src/pages/admin/Members.tsx` | Use new effective status badge |
| `src/pages/admin/CheckIn.tsx` | Use new effective status badge, add warnings |
| `src/pages/admin/Scanner.tsx` | Use new effective status badge |
| `src/components/admin/MemberDetailSheet.tsx` | Add payment status section |
| `src/hooks/useMembersBillingIssues.ts` | Add `canCheckIn` field to issues |
| Database migration | Update `process_member_scan` function |

---

### Expected Outcome

1. Staff will always see accurate, real-time payment status
2. "Active" will only show green when the member is truly in good standing
3. Payment issues will block check-in with clear explanations
4. Overrides will be logged for audit purposes
5. Webhook will properly update status for all payment failures
