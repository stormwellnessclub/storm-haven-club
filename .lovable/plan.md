
# Add "Charge Initiation Fee" with Confirmation Dialog

## Overview
Add a dedicated "Charge Initiation Fee" feature to the Member Detail page with a **mandatory confirmation dialog** that shows all details before charging.

---

## Confirmation Flow

```text
Step 1: Admin clicks "Charge Initiation Fee" button
              ↓
Step 2: Confirmation dialog opens showing:
        ┌─────────────────────────────────────────────┐
        │ 💳 Charge Initiation Fee                    │
        ├─────────────────────────────────────────────┤
        │                                             │
        │ Member:  Jane Smith                         │
        │ Email:   jane@example.com                   │
        │ Tier:    Gold Membership                    │
        │                                             │
        │ ─────────────────────────────────────────── │
        │                                             │
        │ Amount:      $300.00                        │
        │ Description: Initiation Fee                 │
        │ Card:        VISA •••• 4242 (exp 12/26)     │
        │                                             │
        │ ─────────────────────────────────────────── │
        │                                             │
        │ ⚠️ This will charge the card on file and   │
        │    mark the initiation fee as paid.         │
        │                                             │
        │         [Cancel]    [Confirm & Charge $300] │
        └─────────────────────────────────────────────┘
              ↓
Step 3: Admin reviews and clicks "Confirm & Charge"
              ↓
Step 4: Charge processes (with 3DS if required)
              ↓
Step 5: Success → Update database + show confirmation
        Error → Show error message, no changes made
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/MemberDetail.tsx` | Add button, confirmation dialog, and charge handler |

---

## Implementation Details

### 1. New State Variables
- `showInitiationFeeDialog: boolean` - controls dialog visibility
- `isChargingInitiationFee: boolean` - loading state during charge

### 2. "Charge Initiation Fee" Button
- Located in the Initiation Fee summary card
- Only visible when `annual_fee_paid_at` is null (unpaid)
- Disabled with tooltip if no payment method on file
- Shows amount based on member gender ($300/$175)

### 3. Confirmation Dialog Content
The dialog will display:
- **Member Info**: Name, email, membership tier
- **Charge Details**: Amount (calculated from gender), description
- **Card Preview**: Brand, last 4 digits, expiration (fetched from Stripe)
- **Warning**: Clear message about what will happen
- **Actions**: Cancel button + "Confirm & Charge $X" button

### 4. Charge Flow
Uses existing `charge_saved_card_with_3ds` action:
- Amount: 30000 cents ($300) for women, 17500 cents ($175) for men
- Description: "Initiation Fee"
- Handles 3D Secure authentication if card requires it

### 5. Post-Charge Actions
On successful charge:
1. Update `members.annual_fee_paid_at = NOW()`
2. Show success toast with card details
3. Close dialog
4. Refresh member data

On failure:
1. Show error toast with specific decline reason
2. Keep dialog open for retry or cancel
3. No database changes

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No card on file | Button disabled, tooltip: "Add payment method first" |
| Card requires 3DS | Opens 3DS verification modal, continues after auth |
| Charge declined | Shows decline reason, no DB update |
| Already paid | Button not shown (only "Paid" badge visible) |
| Network error | Shows error, allows retry |

---

## Button Placement

The button will appear in the existing Initiation Fee card:

**Before (current):**
```
┌─────────────────────────────────┐
│ Initiation Fee                  │
│ ⚠️ Unpaid                       │
└─────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│ Initiation Fee                  │
│ ⚠️ Unpaid                       │
│                                 │
│ [💳 Charge $300]                │
└─────────────────────────────────┘
```

When clicked, the confirmation dialog opens with full details for review before any charge is made.
