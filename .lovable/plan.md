
## Overview

Currently, when membership dues are charged via the `invoice.payment_succeeded` webhook, the system:
- ✅ Renews monthly credits
- ✅ Updates member status  
- ✅ Records payment attempts
- ❌ **Does NOT** send a branded receipt email to the member

This plan adds receipt email functionality to the webhook so members get a professional receipt every time a recurring payment succeeds.

---

## Current State

The `invoice.payment_succeeded` handler in `stripe-webhook/index.ts` (lines 1015-1252) currently:
1. Validates it's a subscription invoice
2. Determines if it's annual fee or membership subscription
3. Finds the member by subscription ID
4. Extracts payment details (charge ID, payment method, brand, last4)
5. Logs the payment attempt
6. Updates member status and renews credits
7. **Stops here** - no email is sent

---

## What Needs to Change

### 1. Extract Subscription Details
Within the `invoice.payment_succeeded` case, after finding the member, fetch:
- Member email and full name
- Membership type (from members table)
- Stripe price ID to determine tier
- Next billing date (from subscription)

### 2. Send Receipt Email via Edge Function
Invoke the existing `send-email` function with type `'charge_confirmation'` and include:

```typescript
data: {
  name: memberName,
  description: `${subscriptionType} - ${tier}`, // e.g., "Membership Dues - Gold"
  amount: (invoice.amount_paid / 100).toFixed(2), // Convert cents to dollars
  paymentDate: new Date(invoice.created * 1000).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }), // e.g., "Feb 8, 2026"
  nextBillingDate: new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric', 
    year: 'numeric'
  }), // e.g., "Mar 9, 2026"
  cardBrand: cardBrand, // Already extracted
  cardLast4: cardLast4, // Already extracted
  // Note: NO benefitsStartDate for recurring payments (only for initial "Charge Now, Activate Later")
}
```

### 3. Determine Subscription Type
- If `isAnnualFeeInvoice`: type = "Annual Fee"
- Otherwise: type = "Membership Dues"

### 4. Determine Membership Tier
- Query `members` table for `membership_type` field
- Use existing `getTierName()` helper to normalize (e.g., "Gold Member" → "gold")

---

## Implementation Details

### Location
File: `supabase/functions/stripe-webhook/index.ts`

In the `invoice.payment_succeeded` case (line 1015), after the existing payment attempt logging and status/credit updates, add:

```typescript
// Send receipt email to member
try {
  const { data: fullMemberData } = await supabase
    .from('members')
    .select('email, first_name, last_name, membership_type')
    .eq('id', memberData.id)
    .single();

  if (fullMemberData?.email) {
    const subscriptionType = isAnnualFeeInvoice ? 'Annual Fee' : 'Membership Dues';
    const tierName = getTierName(fullMemberData.membership_type || 'silver');
    const tierDisplay = tierName.charAt(0).toUpperCase() + tierName.slice(1); // Capitalize
    const memberName = `${fullMemberData.first_name} ${fullMemberData.last_name}`.trim() || 'Member';
    
    // Get subscription for next billing date
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    
    const nextBillingTs = subscription.current_period_end;
    const nextBillingDate = new Date(nextBillingTs * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const paymentDateStr = new Date(invoice.created * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Send receipt email
    await supabase.functions.invoke('send-email', {
      body: {
        type: 'charge_confirmation',
        to: fullMemberData.email,
        data: {
          name: memberName,
          description: `${subscriptionType} - ${tierDisplay}`,
          amount: (invoice.amount_paid / 100).toFixed(2),
          paymentDate: paymentDateStr,
          nextBillingDate: nextBillingDate,
          cardBrand: cardBrand || 'Unknown',
          cardLast4: cardLast4 || '****',
        },
      },
    });

    logStep("Receipt email sent", { memberId: memberData.id, email: fullMemberData.email });
  }
} catch (emailError) {
  logError(emailError, "RECEIPT_EMAIL");
  // Don't fail webhook for email errors
}
```

### Key Points
1. **Non-blocking**: Email errors don't fail the webhook (wrapped in try/catch)
2. **Existing template**: Uses the `charge_confirmation` template that already handles all formatting
3. **No benefitsStartDate**: Recurring payments don't have a separate benefits start date
4. **Card details**: Already available from payment intent processing
5. **Next billing date**: Extracted from subscription's `current_period_end`

---

## Benefits
- ✅ Members get a branded receipt for every payment (not just first charge)
- ✅ Clear description shows subscription type and tier
- ✅ Shows next billing date so members know when to expect the next charge
- ✅ Uses existing email template (no new design needed)
- ✅ Minimal code change (50-70 lines added to webhook)
- ✅ Non-blocking if email service has issues

---

## Testing Considerations
- Test with a monthly membership renewal
- Test with an annual fee renewal  
- Verify member receives email with correct dates and amount
- Verify card brand/last4 are correctly populated
- Test with members that don't have full name data
