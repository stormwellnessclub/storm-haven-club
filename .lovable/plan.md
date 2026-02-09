

# Plan: Build Admin Tool to Audit & Clean Up Duplicate Initiation Fee Subscriptions

## Overview

This plan creates an admin tool that audits Stripe for customers with multiple initiation fee subscriptions, identifies which ones are linked to the database vs orphaned, and allows one-click cleanup.

---

## Problem Summary

Based on the audit, these members have duplicate initiation fee subscriptions:

| Member | Linked | Orphan (Cancel) |
|--------|--------|-----------------|
| Afifa Seblini | sub_1SyMgvLyZrsSqLhsD9fO8V5a | sub_1SwmP5LyZrsSqLhsIYBBzyaM |
| Deanna Beydoun | sub_1SyM2dLyZrsSqLhsrnbJRaLd | sub_1SwmJNLyZrsSqLhsbkX1lw8p |
| Jacklyn Gougeon | sub_1SyMpmLyZrsSqLhstRSsD8je | sub_1Sxo9SLyZrsSqLhsLW6Gc9Ap |
| Lilian Chahrour | sub_1SyNDKLyZrsSqLhsNeqZ1gzi | sub_1Sxp81LyZrsSqLhsg4MPDJBE |
| Sahar Durant | sub_1SsjMZLyZrsSqLhsPcvRzlKH | sub_1SskJeLyZrsSqLhs1HtypLfX |
| Sarah Kawar | sub_1SykzMLyZrsSqLhsgaovhr9q | sub_1Sy4QiLyZrsSqLhsRozIItrk |
| Khawla Berro | sub_1Syl3uLyZrsSqLhsKB0AR67e | sub_1Syl3eLyZrsSqLhs818h0QKG |
| Ayana Silmi | sub_1Syl5ZLyZrsSqLhsKtI1rcRo | sub_1Syl5ILyZrsSqLhstlijK577 |

---

## Solution: Audit & Cleanup Endpoint

### New Edge Function Action: `audit_duplicate_annual_fees`

**What it does:**
1. Fetches all members with a `stripe_customer_id`
2. For each customer, lists all active subscriptions in Stripe
3. Identifies subscriptions using annual fee price IDs
4. Compares against `annual_fee_subscription_id` in database
5. Returns list of orphaned (unlinked) subscriptions

**Response format:**
```typescript
{
  duplicates: [
    {
      member_id: string;
      member_name: string;
      email: string;
      stripe_customer_id: string;
      linked_subscription_id: string | null;
      orphan_subscriptions: [
        { id: string; created: Date; status: string; last_invoice_amount: number }
      ];
    }
  ];
  total_orphans: number;
}
```

### New Edge Function Action: `cancel_orphan_subscription`

**What it does:**
1. Accepts subscription ID to cancel
2. Verifies it's NOT the linked subscription for any member
3. Cancels the subscription in Stripe
4. Optionally refunds the most recent invoice

---

## Admin UI Component

### New Section in Admin Payments or Settings Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Duplicate Initiation Fee Audit                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Found 8 members with duplicate initiation fee subscriptions.   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Afifa Seblini                    afifa.seblini@gmail.com  │  │
│  │ Linked: sub_1SyMgv... ✓                                   │  │
│  │ Orphan: sub_1SwmP5... (Created Jan 29)                    │  │
│  │         $300.00 charged                                   │  │
│  │                                                           │  │
│  │ [Cancel & Refund]  [Cancel Only]  [View in Stripe]        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Run Audit]  [Cancel All Orphans]                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-payment/index.ts` | Add `audit_duplicate_annual_fees` action |
| `supabase/functions/stripe-payment/index.ts` | Add `cancel_orphan_subscription` action |
| `src/pages/admin/Payments.tsx` | Add Duplicate Audit section with UI |
| `src/components/admin/DuplicateAuditCard.tsx` | New component for audit display |

---

## Implementation Details

### Edge Function: audit_duplicate_annual_fees

```typescript
case 'audit_duplicate_annual_fees': {
  // Get all members with stripe_customer_id
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, stripe_customer_id, annual_fee_subscription_id')
    .not('stripe_customer_id', 'is', null);

  const duplicates = [];
  const annualFeePriceIds = Object.values(STRIPE_PRODUCTS.annualFee);

  for (const member of members) {
    // Get all active subscriptions for this customer
    const subs = await stripe.subscriptions.list({
      customer: member.stripe_customer_id,
      status: 'active',
      limit: 20,
    });

    // Filter to only annual fee subscriptions
    const annualFeeSubs = subs.data.filter(sub =>
      sub.items.data.some(item => annualFeePriceIds.includes(item.price.id)) ||
      sub.metadata.type === 'annual_fee'
    );

    // If more than one, we have duplicates
    if (annualFeeSubs.length > 1) {
      const orphans = annualFeeSubs
        .filter(sub => sub.id !== member.annual_fee_subscription_id)
        .map(sub => ({
          id: sub.id,
          created: new Date(sub.created * 1000).toISOString(),
          status: sub.status,
          last_invoice_amount: sub.latest_invoice?.amount_paid || 0,
        }));

      duplicates.push({
        member_id: member.id,
        member_name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        stripe_customer_id: member.stripe_customer_id,
        linked_subscription_id: member.annual_fee_subscription_id,
        orphan_subscriptions: orphans,
      });
    }
  }

  return { duplicates, total_orphans: duplicates.reduce((acc, d) => acc + d.orphan_subscriptions.length, 0) };
}
```

### Edge Function: cancel_orphan_subscription

```typescript
case 'cancel_orphan_subscription': {
  const { subscriptionId, processRefund } = body;

  // Safety: verify this subscription is NOT linked to any member
  const { data: linkedMember } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .eq('annual_fee_subscription_id', subscriptionId)
    .maybeSingle();

  if (linkedMember) {
    throw new Error(`Cannot cancel - this subscription is linked to ${linkedMember.first_name} ${linkedMember.last_name}`);
  }

  // Cancel the subscription
  await stripe.subscriptions.cancel(subscriptionId);

  // Optionally refund the last payment
  if (processRefund) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
    const invoice = sub.latest_invoice;
    if (invoice?.payment_intent) {
      await stripe.refunds.create({ payment_intent: invoice.payment_intent });
    }
  }

  return { success: true, cancelled: subscriptionId, refunded: processRefund };
}
```

---

## Benefits

1. **Visibility**: See all duplicate subscriptions in one place
2. **Safety**: Cannot accidentally cancel a linked subscription
3. **Speed**: One-click cleanup instead of manual Stripe dashboard work
4. **Audit Trail**: Actions logged for accountability

---

## Immediate Manual Cleanup (Before Tool is Built)

If you need to clean up NOW before this tool is built:

1. **Afifa Seblini**: Cancel `sub_1SwmP5LyZrsSqLhsIYBBzyaM`
2. **Deanna Beydoun**: Cancel `sub_1SwmJNLyZrsSqLhsbkX1lw8p`
3. **Jacklyn Gougeon**: Cancel `sub_1Sxo9SLyZrsSqLhsLW6Gc9Ap`
4. **Lilian Chahrour**: Cancel `sub_1Sxp81LyZrsSqLhsg4MPDJBE`
5. **Sahar Durant**: Cancel `sub_1SskJeLyZrsSqLhs1HtypLfX`
6. **Sarah Kawar**: Cancel `sub_1Sy4QiLyZrsSqLhsRozIItrk`
7. **Khawla Berro**: Cancel `sub_1Syl3eLyZrsSqLhs818h0QKG`
8. **Ayana Silmi**: Cancel `sub_1Syl5ILyZrsSqLhstlijK577`

Go to Stripe Dashboard → Search → Subscriptions → Paste subscription ID → Cancel

