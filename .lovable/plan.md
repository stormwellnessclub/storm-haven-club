# Plan: Fix Receipt Accuracy & Add Separate First Charge Date Option

## Status: ✅ IMPLEMENTED

This plan has been implemented. See summary below.

---

## Changes Made

### 1. CreateSubscriptionDialog.tsx
- Replaced the "Charge now" / "Charge on start date" radio buttons with a more flexible approach
- Added checkbox: "Schedule first charge for a different date"
- Added separate date picker for "First Charge Date"
- Updated signature: `onConfirm(startDate: Date, firstChargeDate: Date | null)`
- Added billing summary showing both dates when different

### 2. MemberDetail.tsx & MemberDetailSheet.tsx  
- Updated `handleCreateSubscription` to accept `firstChargeDate: Date | null`
- Passes `firstChargeDate` (ISO string or null) to the edge function

### 3. stripe-payment Edge Function
- Added `firstChargeDate?: string` to the PaymentRequest interface
- Updated `admin_create_member_subscription` case:
  - Now determines charge date from `firstChargeDate` parameter (null = charge now)
  - Uses `billing_cycle_anchor` only when charge date is in the future
  - Stores both `benefits_start_date` and `first_charge_date` in subscription metadata
  
### 4. Receipt Email Logic (FIXED)
- Receipt is now ONLY sent immediately when charging NOW
- If charge is deferred (future date), receipt is NOT sent immediately
- The stripe-webhook (`invoice.payment_succeeded`) will send the receipt when the actual charge occurs
- Receipt now correctly shows "Benefits Start Date" only when different from payment date

---

## User Experience

**Admin Flow:**
1. Select "Benefits Start Date" (when member can access club)
2. Optionally check "Schedule first charge for different date"
3. If checked, select the charge date
4. See billing summary showing both dates
5. Click "Create Subscription"

**Receipt Behavior:**
- Charge now → Receipt sent immediately with accurate date
- Charge later → No receipt until webhook fires on actual charge date

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Benefits in past, charge now | Charge immediately, send receipt now |
| Benefits today, charge now | Charge immediately, send receipt now |
| Benefits future, charge now | Charge immediately, receipt shows "Benefits Start" date |
| Charge scheduled for future | Defer charge via billing_cycle_anchor, webhook sends receipt later |
