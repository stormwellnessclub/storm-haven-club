
# Plan: Add Receipt Emails & Admin Payment Failure Alerts

## Overview
This plan adds two key features:
1. **Branded Receipt Emails** - Sent to members when dues are charged (with clear charge date vs. activation date when different)
2. **Admin Payment Failure Alerts** - Notify admins when a card declines so they can follow up

---

## Part 1: Enhanced Receipt Emails

### What Changes

**Update `charge_confirmation` Email Template**
- Add optional "Benefits Start" date field (only shows when different from payment date)
- Add billing cycle info (next charge date)

**Trigger Receipt on Subscription Creation**
- When `admin_create_member_subscription` charges a card, invoke send-email with receipt details
- Include `benefits_start_date` when using "Charge Now, Activate Later" flow

### Email Preview (Charge Now, Activate Later)

```text
┌────────────────────────────────────────────────────────────┐
│              [Storm Logo]                                  │
├────────────────────────────────────────────────────────────┤
│  Payment Confirmation                                      │
│                                                            │
│  Dear Jane,                                                │
│                                                            │
│  This email confirms your payment was successful.          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Receipt Details                                     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Description      │  Membership Dues - Gold          │  │
│  │  Amount           │  $250.00                         │  │
│  │  Payment Date     │  Feb 8, 2026                     │  │
│  │  Benefits Start   │  Feb 9, 2026                     │  │
│  │  Next Billing     │  Mar 9, 2026                     │  │
│  │  Payment Method   │  Visa •••• 4242                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Please keep this email for your records.                  │
└────────────────────────────────────────────────────────────┘
```

### Email Preview (Same Day Charge & Activation)

When charge date equals activation date, the "Benefits Start" row is hidden to keep it simple.

---

## Part 2: Admin Payment Failure Alerts

### What Changes

**Create Admin Alert Email Template**
- New type: `admin_payment_failed_alert`
- Includes member name, amount, failure reason, and link to member detail page

**Update Webhook to Notify Admins**
- On `invoice.payment_failed`, also send email to admin inbox (configured via environment or support email)

### Admin Alert Email Preview

```text
┌────────────────────────────────────────────────────────────┐
│  ⚠️ Payment Failed Alert                                   │
├────────────────────────────────────────────────────────────┤
│  Member: Jane Smith                                        │
│  Amount: $250.00 (Membership Dues)                         │
│  Reason: Insufficient funds                                │
│  Status: Past due - will retry in 3 days                   │
│                                                            │
│  [View Member] → links to admin/members/[id]               │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Update `charge_confirmation` template, add `admin_payment_failed_alert` type |
| `supabase/functions/stripe-payment/index.ts` | Send receipt email after subscription creation |
| `supabase/functions/stripe-webhook/index.ts` | Send admin alert on payment failure |

### New Email Template Fields

**charge_confirmation** (enhanced):
```typescript
data: {
  name: string;
  description: string;
  amount: string; // e.g., "250.00"
  paymentDate: string; // e.g., "Feb 8, 2026"
  benefitsStartDate?: string; // Only if different from paymentDate
  nextBillingDate?: string; // e.g., "Mar 9, 2026"
  cardBrand: string;
  cardLast4: string;
}
```

**admin_payment_failed_alert** (new):
```typescript
data: {
  memberName: string;
  memberEmail: string;
  memberId: string;
  amount: number;
  failureReason: string;
  subscriptionType: string; // "Membership Dues" or "Annual Fee"
  willRetry: boolean;
  nextRetryDate?: string;
}
```

### Configuration

The admin email recipient will be:
1. First check for `ADMIN_ALERT_EMAIL` secret
2. Fallback to `hello@stormwellnessclub.com` (or configurable)

---

## Summary

| Feature | Member Gets | Admin Gets |
|---------|-------------|------------|
| Successful charge | Receipt email with charge date & activation date | - |
| Failed charge | Notification to update card | Alert with member details & failure reason |

Both Stripe's built-in emails AND these custom branded emails can work together - Stripe handles immediate transactional receipts while your branded emails provide a better experience with specific details like "Benefits Start" date.
