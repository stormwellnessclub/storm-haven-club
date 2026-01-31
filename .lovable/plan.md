
# Remove Website Links from Payment Receipt Emails

## Summary

Payment receipt emails sent from the admin application portal currently include footer links to the member portal (support, bookings, website). Since these receipts go to applicants who may not have accounts yet, the links should be removed.

---

## Problem Analysis

The `charge_confirmation` email template uses the shared `getEmailFooter()` function which includes:
- Link to member support portal
- Link to manage bookings  
- Link to main website

These links are inappropriate for applicants who haven't activated their membership yet.

---

## Solution

Create a minimal footer specifically for receipt emails that only contains contact information without clickable links to the portal.

### Update send-email Edge Function

**File**: `supabase/functions/send-email/index.ts`

1. Create a new receipt-specific footer function:

```typescript
const getReceiptFooter = () => `
  <div style="${emailStyles.footer}">
    <p style="${emailStyles.muted}">
      Questions about this charge? Reply to this email or contact us.
    </p>
    <p style="${emailStyles.muted}">
      Storm Wellness Club
    </p>
  </div>
`;
```

2. Update the `charge_confirmation` case to use the new footer:

```typescript
case 'charge_confirmation':
  // ... existing content ...
  ${getReceiptFooter()}  // Instead of ${getEmailFooter()}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Add `getReceiptFooter()` function and use it for charge_confirmation emails |

---

## Expected Results

| Element | Before | After |
|---------|--------|-------|
| Footer links | Contains portal links | No links - just contact info |
| Support reference | "Visit your member portal" | "Reply to this email or contact us" |
| Website link | stormwellnessclub.com (clickable) | Storm Wellness Club (text only) |
