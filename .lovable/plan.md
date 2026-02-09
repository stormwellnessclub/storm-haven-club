

## Fix Two Issues: Active Status with Failed Payments + Membership Agreement Not Opening

### Issue 1: Members Showing Wrong Status Despite Failed Payments

**Root Cause**: The `getEffectiveStatus()` function in `EffectiveStatusBadge.tsx` checks `memberStatus` (the DB `status` column) BEFORE checking billing issues. For members like Deana Boussi with `status = 'pending_activation'`, it returns "Pending Activation" at line 75 and never evaluates the `subscription_incomplete` billing issue. For Wafaa Diab with `status = 'active'` and `subscription_status = 'incomplete'`, the function checks for `failed_payment` code but NOT `subscription_incomplete` code.

**Fix**: Update `getEffectiveStatus()` to:
1. Check for `subscription_incomplete` billing issues BEFORE returning terminal statuses
2. For `pending_activation` members with `subscription_status = 'incomplete'`, show "Payment Failed" instead of "Pending Activation"

**Files to modify**:
- `src/components/admin/EffectiveStatusBadge.tsx` -- Add `subscription_incomplete` to the `hasFailedPayment` check, and move the payment failure check above the `pending_activation` return so members with incomplete subscriptions show as "Payment Failed" rather than just "Pending Activation"

**Specific change in `getEffectiveStatus()`**:
```
// Before checking pending_activation, check for subscription_incomplete
const hasFailedPayment = issues.some(i => 
  i.code === 'failed_payment' || 
  i.code === 'subscription_incomplete' || 
  i.code === 'subscription_incomplete_expired'
);

// Payment failed takes priority over pending_activation
if (hasFailedPayment) {
  return { status: 'payment_failed', canCheckIn: false, ... };
}

// Then check pending_activation
if (status === 'pending_activation') { ... }
```

---

### Issue 2: Membership Agreement PDF Not Opening

**Root Cause**: The `membership-agreement.pdf` file exists in `src/assets/agreements/` and is correctly mapped in `SimpleAgreementCard.tsx` via `pdfMap`. The import resolves to a Vite asset path. However, the file itself may not be a valid PDF -- it could be corrupted, empty, or saved in the wrong format (e.g., an HTML file renamed to .pdf).

**Diagnosis needed**: The import and download logic looks correct. The most likely cause is:
1. The actual file `src/assets/agreements/membership-agreement.pdf` is not a valid PDF (corrupted or wrong format)
2. There is a backup file `membership-agreement-backup.pdf` which suggests the main file may have been replaced with a bad version

**Fix**:
- Replace `membership-agreement.pdf` with the backup file `membership-agreement-backup.pdf` (or a known-good PDF)
- Alternatively, if the file IS valid but just not rendering in-browser, add proper MIME type handling

Since I cannot verify the file contents directly, the safest approach is:
1. Copy/rename `membership-agreement-backup.pdf` to replace `membership-agreement.pdf`
2. If neither file works, you will need to re-upload a valid PDF

**Files to modify**:
- `src/assets/agreements/membership-agreement.pdf` -- Replace with a valid PDF (use the backup)

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/admin/EffectiveStatusBadge.tsx` | Move payment failure check above pending_activation; add `subscription_incomplete` to failure detection |
| `src/assets/agreements/membership-agreement.pdf` | Replace with valid PDF from backup |

