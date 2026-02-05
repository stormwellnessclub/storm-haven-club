

# Comprehensive Admin Safety & Refund System Implementation

## Problem Analysis

Based on your screenshot and feedback, I've identified several critical issues with the current admin system:

### Current Problems

| Issue | Impact | Severity |
|-------|--------|----------|
| **Published vs Preview mismatch** | Safety improvements exist in code but may not be deployed to published site | Critical |
| **"Sell Package" auto-activates** | Clicking button creates subscription without confirmation/preview | Critical |
| **No refund capability** | Staff cannot issue refunds from within the portal | Critical |
| **No undo for dangerous actions** | Cannot reverse status changes, subscriptions, or package sales | High |
| **No manager tracking** | Refunds not traceable to specific staff member | High |
| **Insufficient confirmation dialogs** | One-click actions with irreversible consequences | High |

---

## Proposed Solution: Multi-Layer Safety System

### Phase 1: Fix Published Site Display

**Root Cause**: The `AdminActionButton` component and `CreateSubscriptionDialog` exist in code but the changes may need to be published.

**Action**: Verify that `AdminActionButton` with info icons and tooltips is correctly wired up to all admin action buttons in `MemberDetail.tsx`.

### Phase 2: Comprehensive Refund System

#### 2.1 Database Changes

```text
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  original_charge_id UUID,          -- links to manual_charges
  original_payment_intent_id TEXT,  -- Stripe payment intent
  refund_type TEXT,                 -- 'full', 'partial'
  amount_cents INTEGER,
  reason TEXT,
  status TEXT,                      -- 'pending_approval', 'approved', 'rejected', 'processed'
  requested_by UUID,                -- staff user_id
  manager_code TEXT,                -- tracking code for manager
  approved_by UUID,                 -- super_admin user_id (for membership charges)
  stripe_refund_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2 Access Control

| Charge Type | Who Can Refund | Approval Required |
|-------------|----------------|-------------------|
| Membership dues | Super Admin only | No (direct processing) |
| Initiation/Annual fee | Super Admin only | No (direct processing) |
| Class packages | Manager+ with code | No |
| Spa/Cafe charges | Manager+ with code | No |

#### 2.3 Manager Code System

Each manager will have a unique 4-6 character code stored in their profile:

```text
ALTER TABLE public.profiles ADD COLUMN manager_refund_code TEXT;
```

When processing a refund, managers must enter their code which gets logged with the refund record for audit purposes.

### Phase 3: Undo/Reverse System

#### 3.1 Member Status Changes

Add a "Revert Status" button that:
- Shows the previous status from `subscription_status_history` table
- Allows reverting to previous status with confirmation
- Logs the reversion in the activity table

#### 3.2 Subscription Undo (within grace period)

For "Create Subscription" mistakes within 24 hours:
- Cancel the Stripe subscription (prorated)
- Revert member status to `pending_activation`
- Remove allocated credits
- Log as "Admin Undo" in activity

#### 3.3 "Sell Membership" Undo

- Cancel subscription in Stripe
- Optionally process full refund
- Revert member status
- Clear payment tracking

#### 3.4 "Sell Class Package" Undo

- Mark class pass as `cancelled`
- Optionally process refund
- Log cancellation

### Phase 4: Enhanced Confirmation Dialogs

All dangerous actions will use the `AdminActionButton` pattern with:

1. **Info icon tooltip** - Explains what the action does
2. **Multi-step confirmation dialog** showing:
   - What will happen
   - What will be charged (if applicable)
   - Whether it can be undone
   - Any dependencies/side effects

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/RefundDialog.tsx` | Refund processing UI with manager code input |
| `src/components/admin/UndoActionDialog.tsx` | Generic undo confirmation with action preview |
| `src/hooks/useAdminRefunds.ts` | Refund mutations and queries |
| `supabase/migrations/xxxxx_refund_system.sql` | Refund tables and functions |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/MemberDetail.tsx` | Add refund buttons, undo buttons, ensure AdminActionButton is used everywhere |
| `src/pages/admin/Payments.tsx` | Connect "Issue Refund" dropdown to actual refund dialog |
| `src/components/admin/SellMembershipPackage.tsx` | Add confirmation preview before processing |
| `src/components/admin/SellClassPackage.tsx` | Add confirmation preview before processing |
| `src/components/ChargeHistory.tsx` | Already has refund dialog - ensure it's properly exposed |
| `supabase/functions/stripe-payment/index.ts` | Add `process_admin_refund` and `undo_subscription` actions |

### Edge Function Additions

#### `process_admin_refund` action:
- Validates manager code OR super admin role
- Processes Stripe refund
- Updates database records
- Logs refund with manager tracking

#### `undo_subscription` action:
- Cancels subscription with proration
- Reverts member status
- Clears allocated credits
- Logs undo action

---

## Sell Package Confirmation Flow

### Current (Problematic)
```text
Click "Sell Package" → Dialog opens → Click "Process Payment" → Immediate execution
```

### Proposed (Safe)
```text
Click "Sell Package" → Dialog opens → Configure options → 
Click "Review" → Preview dialog shows:
  - Member: John Doe
  - Package: Gold Membership (Monthly)
  - Price: $250/mo
  - Card: Visa •••• 4242
  - Credits: 4 Red Light, 2 Dry Cryo
  - ⚠️ This will charge the card and activate the membership
→ Click "Confirm & Process" → Execution
```

---

## Refund UI Design

### In Payments Tab (MemberDetail.tsx)

Each charge row will show:
```text
┌─────────────────────────────────────────────────────────┐
│ Jan 15, 2026 • Initiation Fee                          │
│ $300.00 • Paid                                         │
│ Visa •••• 4242                                         │
│                                                        │
│ [View Receipt] [Issue Refund] [Resend Receipt]         │
└─────────────────────────────────────────────────────────┘
```

### Refund Dialog

```text
┌────────────────────────────────────────────────────────────┐
│ Process Refund                                             │
├────────────────────────────────────────────────────────────┤
│ Original Charge: Initiation Fee                            │
│ Amount: $300.00                                            │
│ Date: Jan 15, 2026                                         │
│                                                            │
│ Refund Amount: [$300.00    ] (max: $300.00)               │
│                                                            │
│ Refund Method:                                             │
│ ○ Stripe (back to card)                                    │
│ ○ Check (manual)                                           │
│ ○ Other (manual)                                           │
│                                                            │
│ Manager Code: [______] (required for tracking)             │
│                                                            │
│ Notes: [________________________________]                  │
│                                                            │
│ ⚠️ This action cannot be undone.                          │
│                                                            │
│                        [Cancel] [Process Refund]           │
└────────────────────────────────────────────────────────────┘
```

For membership-related charges, only Super Admins see the refund button.

---

## Undo Actions UI

### In Member Header Actions

```text
┌─────────────────────────────────────────────────────────┐
│ Storm Text                                              │
│ [Active ✓]  STM-000124                                  │
│                                                         │
│ [Edit] [Suspend] [Delete] [Undo Last Action ↩]         │
└─────────────────────────────────────────────────────────┘
```

### Undo Dialog

```text
┌────────────────────────────────────────────────────────────┐
│ Undo Last Action                                           │
├────────────────────────────────────────────────────────────┤
│ Last action: Created Subscription                          │
│ When: 5 minutes ago                                        │
│ By: admin@storm.com                                        │
│                                                            │
│ This will:                                                 │
│ ✗ Cancel the Stripe subscription (no refund)              │
│ ✗ Revert status to "pending_activation"                   │
│ ✗ Remove 4 Red Light, 2 Dry Cryo credits                  │
│                                                            │
│ □ Also process refund for initial charge ($250.00)        │
│                                                            │
│                        [Cancel] [Undo Action]              │
└────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Priority | Feature | Effort |
|----------|---------|--------|
| 1 | Verify AdminActionButton is working on published site | Low |
| 2 | Add confirmation dialog to SellMembershipPackage | Medium |
| 3 | Add confirmation dialog to SellClassPackage | Medium |
| 4 | Implement refund system (DB + Edge Function + UI) | High |
| 5 | Add manager code tracking | Medium |
| 6 | Implement undo for subscription creation | High |
| 7 | Implement undo for status changes | Medium |
| 8 | Implement undo for package sales | Medium |

---

## Expected Outcome

After implementation:

- Every dangerous action requires multi-step confirmation with clear preview
- Refunds can be processed for all charge types with proper access control
- Super Admins can refund membership-related charges
- Managers can refund other charges with their tracking code
- All refunds are logged with who processed them and why
- Recent actions can be undone within a grace period
- Staff can hover over info icons to understand button consequences
- Accidental clicks cannot execute irreversible actions

