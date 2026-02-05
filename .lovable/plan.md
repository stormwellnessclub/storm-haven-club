
# Complete the Refund and Undo System

## Current State Analysis

After reviewing the codebase, here's what exists vs. what's missing:

### Already Implemented
| Component | Status |
|-----------|--------|
| `refund_requests` table | Database schema exists |
| `admin_action_log` table | Database schema exists |
| `RefundDialog.tsx` | UI component exists (standalone, 310 lines) |
| `UndoActionDialog.tsx` | UI component exists (standalone, 175 lines) |
| `useAdminRefunds.ts` | Hook exists with mutations for `process_admin_refund` and `undo_admin_action` |
| `refund_charge` action | Edge function action exists (basic Stripe refund) |

### Missing Components
| Component | Status | Priority |
|-----------|--------|----------|
| `process_admin_refund` action | NOT in edge function | High |
| `undo_admin_action` action | NOT in edge function | High |
| RefundDialog integration | NOT imported in MemberDetail | Medium |
| UndoActionDialog integration | NOT imported in MemberDetail | Medium |
| "Undo Last Action" button | NOT in MemberDetail UI | Medium |
| Action logging for sales | NOT wired up after subscriptions/packages | Medium |

---

## Implementation Plan

### Part 1: Edge Function Actions

Add two new actions to `supabase/functions/stripe-payment/index.ts`:

**Action: `process_admin_refund`**
```text
Purpose: Process refunds with proper authorization and logging
Features:
- Validates super_admin for membership charges
- Validates manager_refund_code for other charges  
- Logs to refund_requests table
- Supports Stripe, check, or "other" refund methods
- Partial refund support
```

**Action: `undo_admin_action`**
```text
Purpose: Reverse recent admin actions (subscriptions, sales, status changes)
Features:
- Validates action is within 24-hour window
- Cancel Stripe subscription if applicable
- Revert member status
- Remove allocated credits
- Optional refund of initial charge
- Mark action as undone in admin_action_log
```

### Part 2: UI Integration in MemberDetail.tsx

**Changes:**
1. Import `RefundDialog` and `UndoActionDialog` components
2. Import `useLastUndoableAction` hook
3. Add state for dialog visibility and selected charge
4. Add "Undo Last Action" button near status area (when action available)
5. Wire refund button from ChargeHistory to open RefundDialog
6. Wire undo button to open UndoActionDialog

---

## Technical Details

### Edge Function: `process_admin_refund`

```text
Input Parameters:
- memberId: string
- chargeId?: string (manual_charges.id)
- paymentIntentId?: string (Stripe payment intent)
- chargeType: string
- refundAmount: number (cents)
- refundNotes?: string
- managerCode?: string
- refundMethodType: 'stripe' | 'check' | 'other'

Process:
1. Verify admin/staff role
2. If membership charge: verify super_admin role
3. If non-super_admin: validate manager_refund_code exists in profiles
4. If Stripe method: call stripe.refunds.create()
5. Log to refund_requests table
6. Update manual_charges status if applicable
7. Return success with refund details
```

### Edge Function: `undo_admin_action`

```text
Input Parameters:
- actionLogId: string
- includeRefund?: boolean
- managerCode?: string

Process:
1. Fetch action from admin_action_log
2. Validate action is undoable (can_undo=true, not expired, not already undone)
3. Based on action_type:
   - 'create_subscription' / 'sell_membership':
     a. Cancel Stripe subscription (subscription.cancel())
     b. Reset member status to 'pending_activation'
     c. Remove allocated credits (if tracked in action_data)
   - 'sell_class_package':
     a. Mark class_passes record as cancelled
   - 'status_change':
     a. Revert to previous status (action_data.old_status)
4. If includeRefund && action_data.payment_intent_id:
   a. Process Stripe refund
5. Mark action as undone (undone_at, undone_by)
6. Return success with memberId for cache invalidation
```

### MemberDetail.tsx Integration

```text
New Imports:
- RefundDialog from '@/components/admin/RefundDialog'
- UndoActionDialog from '@/components/admin/UndoActionDialog'
- useLastUndoableAction from '@/hooks/useAdminRefunds'

New State:
- showRefundDialog: boolean
- selectedCharge: ChargeInfo | null
- showUndoDialog: boolean

New UI Elements:
1. Undo button (near status badge) - shows when lastUndoableAction exists
2. RefundDialog - triggered from ChargeHistory refund buttons
3. UndoActionDialog - triggered from undo button

ChargeHistory Update:
- Pass onRefundClick callback prop
- Opens RefundDialog with selected charge
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-payment/index.ts` | Add `process_admin_refund` and `undo_admin_action` actions |
| `src/pages/admin/MemberDetail.tsx` | Import dialogs, add state, add Undo button, wire RefundDialog |
| `src/components/ChargeHistory.tsx` | Add `onRefundClick` callback prop for external dialog trigger |

---

## Benefits

- **Complete refund workflow**: Admins can process refunds with proper authorization
- **Undo capability**: 24-hour grace period to reverse accidental activations or sales
- **Audit trail**: All refunds and undos logged to database
- **Role-based security**: Super admin required for membership refunds, manager code for others
- **Consistent UI**: Uses existing dialog components, just wires them up
