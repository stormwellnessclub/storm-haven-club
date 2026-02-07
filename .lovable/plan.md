
# Comprehensive Multi-Phase Implementation Plan

## Summary of All Issues to Address

Based on our discussions, here are ALL the items that need to be implemented:

| # | Issue | Current State | Priority |
|---|-------|---------------|----------|
| 1 | Password Reset Workflow | ✅ DONE | - |
| 2 | Admin sees only 1 card (not all saved cards) | `MemberDetailSheet` shows cached metadata only | HIGH |
| 3 | Onboarding checklist missing "Pay Initiation Fee" step | Members without fee paid have no guidance | HIGH |
| 4 | Cancelled apps leave orphaned member records | 10 orphaned members exist | HIGH |
| 5 | No "Final Notice" email for unpaid members | Need TODAY deadline template | HIGH |
| 6 | Admin email logic doesn't differentiate paid/unpaid | Always sends same email type | MEDIUM |
| 7 | "Request Initiation Fee" admin action missing | Need dedicated button in Applications | MEDIUM |

---

## Phase 1: Fix Admin Payment Method Display

**Goal**: Allow admins to see ALL payment methods saved in Stripe, not just cached metadata.

### File: `src/components/admin/MemberDetailSheet.tsx`

**Current** (lines 812-823): Only shows one card from `member.card_brand`/`member.card_last4`

**Changes**:
1. Import `useAdminMemberPaymentMethods` hook
2. Replace single card display with loop through all Stripe payment methods
3. Add a "Refresh from Stripe" button to force-sync
4. Show default card indicator and all expiration dates

```typescript
// Add import at top
import { useAdminMemberPaymentMethods, useRefreshAdminMemberPaymentMethods } from "@/hooks/useAdminMemberPaymentMethods";

// Inside component, after member check
const { data: stripePaymentMethods, isLoading: isLoadingPMs } = 
  useAdminMemberPaymentMethods(member?.id);
const refreshPaymentMethods = useRefreshAdminMemberPaymentMethods();

// Replace the single card display block with:
{isLoadingPMs ? (
  <div className="flex items-center gap-2 p-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm text-muted-foreground">Loading cards...</span>
  </div>
) : stripePaymentMethods?.paymentMethods?.length > 0 ? (
  <div className="space-y-2">
    {stripePaymentMethods.paymentMethods.map((pm) => (
      <div key={pm.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{pm.brand?.toUpperCase()} •••• {pm.last4}</span>
        {pm.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
        <span className="text-muted-foreground text-xs ml-auto">
          Exp: {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
        </span>
      </div>
    ))}
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => refreshPaymentMethods.mutate(member.id)}
      disabled={refreshPaymentMethods.isPending}
    >
      <RefreshCcw className="h-3 w-3 mr-1" />
      Refresh from Stripe
    </Button>
  </div>
) : (
  <p className="text-sm text-muted-foreground">No cards on file</p>
)}
```

---

## Phase 2: Add "Pay Initiation Fee" to Onboarding Checklist

**Goal**: Members who haven't paid the initiation fee see it as the FIRST task.

### File: `src/components/member/MemberOnboardingChecklist.tsx`

**Changes**:
1. Add new props: `isInitiationFeePaid: boolean`, `onPayInitiationFee: () => void`, `gender?: string`
2. Conditionally prepend "Pay Initiation Fee" task when not paid
3. Add dollar icon for the initiation fee task

```typescript
interface MemberOnboardingChecklistProps {
  memberName: string;
  membershipType: string;
  hasPaymentMethod: boolean;
  hasMembershipAgreement: boolean;
  hasLiabilityWaiver: boolean;
  isFoundingMember?: boolean;
  isInitiationFeePaid: boolean;           // NEW
  onPayInitiationFee?: () => void;        // NEW
  isPayingInitiationFee?: boolean;        // NEW - loading state
}

// Build tasks array conditionally
const tasks: OnboardingTask[] = [];

// Add initiation fee task FIRST if not paid
if (!isInitiationFeePaid) {
  tasks.push({
    id: "initiation-fee",
    label: "Pay Initiation Fee",
    description: "One-time fee of $300 to activate your membership",
    complete: false,
    actionLabel: "Pay Now",
    // Custom handler instead of link
  });
}

// Then add the other tasks...
tasks.push(
  { id: "payment", ... },
  { id: "membership-agreement", ... },
  { id: "liability-waiver", ... }
);
```

### File: `src/pages/member/Membership.tsx`

**Changes**:
1. Add `handlePayInitiationFee` function
2. Pass `isInitiationFeePaid` to checklist
3. Handle Stripe redirect on success

```typescript
const [isPayingInitiationFee, setIsPayingInitiationFee] = useState(false);

const handlePayInitiationFee = async () => {
  if (!membership) return;
  setIsPayingInitiationFee(true);
  try {
    const { data, error } = await supabase.functions.invoke("stripe-payment", {
      body: {
        action: "pay_annual_fee",
        memberId: membership.id,
        successUrl: `${window.location.origin}/member/membership?annual_fee_paid=true`,
        cancelUrl: `${window.location.origin}/member/membership`,
      },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    toast.error("Failed to start payment. Please try again.");
  } finally {
    setIsPayingInitiationFee(false);
  }
};

// Pass to checklist
<MemberOnboardingChecklist
  ...
  isInitiationFeePaid={isInitiationFeePaid}
  onPayInitiationFee={handlePayInitiationFee}
  isPayingInitiationFee={isPayingInitiationFee}
/>
```

---

## Phase 3: Fix Orphaned Members on Application Cancel

**Goal**: When an application is cancelled/rejected, also update the member record.

### File: `src/pages/admin/Applications.tsx`

**Changes** to `updateStatusMutation` (around line 378):

```typescript
// After updating application status...
const { error } = await supabase
  .from("membership_applications")
  .update({ status })
  .eq("id", id);
if (error) throw error;

// NEW: Sync member status when cancelling/rejecting
if (status === "cancelled" || status === "rejected") {
  // Get the application email first
  const { data: appData } = await supabase
    .from("membership_applications")
    .select("email")
    .eq("id", id)
    .single();
  
  if (appData?.email) {
    const { error: memberUpdateError } = await supabase
      .from("members")
      .update({ 
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .ilike("email", appData.email)
      .eq("status", "pending_activation"); // Only affect pending members
    
    if (memberUpdateError) {
      console.error("Failed to sync member status:", memberUpdateError);
    } else {
      console.log("Synced member status to cancelled for:", appData.email);
    }
  }
}
```

### Database Migration (One-Time Cleanup)

Fix the 10 existing orphaned records:

```sql
-- One-time fix for orphaned member records
UPDATE members m
SET status = 'cancelled', updated_at = NOW()
FROM membership_applications ma
WHERE LOWER(m.email) = LOWER(ma.email)
  AND ma.status = 'cancelled'
  AND m.status = 'pending_activation';
```

---

## Phase 4: Add Final Notice Email Template

**Goal**: Create `annual_fee_final_notice` with TODAY deadline and grace period option.

### File: `supabase/functions/send-email/index.ts`

**Add new case** (after `annual_fee_payment_request` around line 968):

```typescript
case 'annual_fee_final_notice':
  subject = '⚠️ FINAL NOTICE: Complete Your Payment Today - Storm Wellness Club';
  const finalFeeAmount = data.amount || 300;
  html = `
    <div style="${emailStyles.container}">
      <!-- RED Warning Banner -->
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <p style="color: white; font-weight: bold; font-size: 20px; margin: 0; font-family: Georgia, serif;">
          ⚠️ FINAL NOTICE - ACTION REQUIRED TODAY
        </p>
      </div>
      
      ${getEmailHeader()}
      
      <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
        <h2 style="${emailStyles.heading}; font-family: Georgia, serif;">Dear ${data.name},</h2>
        
        <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, serif;">
          <strong>Your initiation fee payment of $${finalFeeAmount} must be completed TODAY.</strong>
        </p>
        
        <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, serif;">
          This is your final notice. If payment is not received by end of day, your membership approval will expire and you will need to resubmit your application.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.paymentUrl}" style="background-color: #DC2626; color: white; padding: 16px 40px; text-decoration: none; font-weight: bold; border-radius: 4px; font-family: Georgia, serif; font-size: 18px; display: inline-block;">
            PAY NOW - $${finalFeeAmount}
          </a>
        </div>
        
        <!-- Grace Period Option -->
        <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-weight: 600; color: #92400e; font-family: Georgia, serif; font-size: 16px;">
            Need more time?
          </p>
          <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px; font-family: Georgia, serif;">
            Contact us immediately at <a href="mailto:info@stormwellnessclub.com" style="color: #92400e;">info@stormwellnessclub.com</a> to request a one-week grace period. Extensions are granted on a case-by-case basis.
          </p>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px; font-family: Georgia, serif;">
          If you have already completed payment, please disregard this notice.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, serif;">Regards,</p>
          <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, serif;">Storm Wellness Club</p>
        </div>
      </div>
      ${getReceiptFooter()}
    </div>
  `;
  break;
```

---

## Phase 5: Add Admin Actions for Payment Request Emails

**Goal**: Add "Request Initiation Fee" and "Send Final Notice" buttons.

### File: `src/pages/admin/Applications.tsx`

**Add handler functions**:

```typescript
// Send initiation fee payment request
const sendPaymentRequest = async (application: Application) => {
  const firstName = application.first_name || application.full_name.trim().split(" ")[0];
  
  try {
    // Generate payment link
    const { data: linkData } = await supabase.functions.invoke("stripe-payment", {
      body: {
        action: "create_annual_fee_payment_link",
        stripeCustomerId: application.stripe_customer_id,
        applicantEmail: application.email,
        applicantName: `${application.first_name} ${application.last_name}`,
        gender: application.gender || "Women",
      },
    });
    
    await supabase.functions.invoke("send-email", {
      body: {
        type: "annual_fee_payment_request",
        to: application.email,
        data: {
          name: firstName,
          amount: 300,
          paymentUrl: linkData?.url || `${window.location.origin}/auth`,
        },
      },
    });
    
    toast.success(`Payment request sent to ${application.email}`);
  } catch (error) {
    toast.error("Failed to send payment request");
  }
};

// Send final notice
const sendFinalNotice = async (application: Application) => {
  const firstName = application.first_name || application.full_name.trim().split(" ")[0];
  
  try {
    const { data: linkData } = await supabase.functions.invoke("stripe-payment", {
      body: {
        action: "create_annual_fee_payment_link",
        stripeCustomerId: application.stripe_customer_id,
        applicantEmail: application.email,
        applicantName: `${application.first_name} ${application.last_name}`,
        gender: application.gender || "Women",
      },
    });
    
    await supabase.functions.invoke("send-email", {
      body: {
        type: "annual_fee_final_notice",
        to: application.email,
        data: {
          name: firstName,
          amount: 300,
          paymentUrl: linkData?.url || `${window.location.origin}/auth`,
        },
      },
    });
    
    toast.success(`Final notice sent to ${application.email}`);
  } catch (error) {
    toast.error("Failed to send final notice");
  }
};
```

**Add to dropdown menu** (for approved apps with unpaid fee):

```typescript
{application.status === 'approved' && application.annual_fee_status !== 'paid' && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => sendPaymentRequest(application)}>
      <Wallet className="mr-2 h-4 w-4" />
      Request Initiation Fee
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => sendFinalNotice(application)}>
      <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
      Send Final Notice
    </DropdownMenuItem>
  </>
)}
```

### File: `src/pages/admin/Members.tsx`

**Update email logic** to differentiate based on payment status:

```typescript
// Modify the sendPhase1SetupEmail function or add conditional logic
// For members WITHOUT annual_fee_paid_at - send payment request instead
// For members WITH annual_fee_paid_at - send setup email

{member.annual_fee_paid_at ? (
  <DropdownMenuItem onClick={(e) => sendPhase1SetupEmail(member, e)}>
    <Mail className="mr-2 h-4 w-4" />
    Send Setup Email
  </DropdownMenuItem>
) : (
  <>
    <DropdownMenuItem onClick={(e) => sendPaymentRequest(member, e)}>
      <Wallet className="mr-2 h-4 w-4" />
      Request Initiation Fee
    </DropdownMenuItem>
    <DropdownMenuItem onClick={(e) => sendFinalNotice(member, e)}>
      <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
      Send Final Notice
    </DropdownMenuItem>
  </>
)}
```

---

## Files Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `src/components/admin/MemberDetailSheet.tsx` | Add all Stripe cards display |
| 2 | `src/components/member/MemberOnboardingChecklist.tsx` | Add initiation fee task |
| 2 | `src/pages/member/Membership.tsx` | Add payment handler |
| 3 | `src/pages/admin/Applications.tsx` | Sync member status on cancel |
| 3 | Database | One-time cleanup migration |
| 4 | `supabase/functions/send-email/index.ts` | Add final notice template |
| 5 | `src/pages/admin/Applications.tsx` | Add email action buttons |
| 5 | `src/pages/admin/Members.tsx` | Differentiate email by payment status |

---

## User Flow After Implementation

**For members who have NOT paid initiation fee:**
```text
Admin sends "Request Initiation Fee" or "Final Notice" email
           ↓
Member clicks link → Signs in
           ↓
Sees onboarding checklist with 4 tasks:
  ○ Pay Initiation Fee ($300) ← NEW FIRST TASK
  ○ Add Payment Method
  ○ Sign Membership Agreement
  ○ Sign Liability Waiver
           ↓
Clicks "Pay Now" → Stripe Checkout
           ↓
Returns with success → Task complete
           ↓
Complete remaining tasks → Awaiting activation
```

**For members who HAVE paid initiation fee:**
```text
Admin sends "Setup Email"
           ↓
Member clicks link → Signs in
           ↓
Sees onboarding checklist with 3 tasks:
  ○ Add Payment Method
  ○ Sign Membership Agreement
  ○ Sign Liability Waiver
           ↓
All complete → Awaiting staff activation
           ↓
Admin activates → Subscription starts Feb 9th
```

---

## Testing Checklist

**Phase 1 - Admin Card Display:**
- [ ] Open MemberDetailSheet for member with 3 cards
- [ ] Verify all 3 cards appear with brand, last4, expiration
- [ ] Verify "Default" badge on correct card
- [ ] "Refresh from Stripe" button works

**Phase 2 - Onboarding Checklist:**
- [ ] Member without initiation fee paid sees "Pay Initiation Fee" as task 1
- [ ] Clicking "Pay Now" redirects to Stripe
- [ ] After payment, task marked complete
- [ ] Member WITH fee paid doesn't see this task

**Phase 3 - Orphan Cleanup:**
- [ ] Cancel application → member status becomes "cancelled"
- [ ] Cancelled members don't appear in active lists
- [ ] One-time migration fixes 10 existing orphans

**Phase 4 - Final Notice Email:**
- [ ] Email has red warning banner
- [ ] Payment button works
- [ ] Grace period text present

**Phase 5 - Admin Actions:**
- [ ] "Request Initiation Fee" appears for unpaid approved apps
- [ ] "Send Final Notice" appears for unpaid approved apps
- [ ] Members page shows correct email option based on payment status
