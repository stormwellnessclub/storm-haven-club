

## Plan: Fix Incorrect "Freeze Completed" Email Being Sent During Member Activation

### Problem Summary
Members are receiving the "Membership Reactivated - Welcome Back to Storm Wellness Club!" email (the `freeze_completed` template) when their accounts are activated, even though they never had a freeze on their account.

### Investigation Findings
After a thorough code review:

1. **The `freeze_completed` email template** exists in the send-email function
2. **Only one place in the codebase calls this email**: `process-freeze-expirations/index.ts` (at line 169)
3. **No freeze records exist** in the `member_freezes` table
4. **The freeze expiration function has never run** according to logs
5. **No database triggers** send emails on status changes

This indicates there may be a **deployed Edge Function that differs from the repository code**. The freeze_completed email is being triggered from somewhere not visible in the current codebase.

### Proposed Solution

#### Step 1: Redeploy All Email-Related Edge Functions
Force redeploy the edge functions to ensure the deployed code matches the repository:
- `send-email`
- `stripe-webhook`
- `stripe-payment`
- `process-freeze-expirations`

This will ensure no stale code is running that might be sending this email incorrectly.

#### Step 2: Add Safety Check to `freeze_completed` Template
Add a validation step in the send-email function that logs when `freeze_completed` is called, and optionally requires a valid freeze record ID before sending:

```typescript
case 'freeze_completed':
  // Log for debugging
  console.log('[SEND-EMAIL] freeze_completed called', { to, data });
  
  // Validate freeze data exists
  if (!data.freezeEndDate && !data.freezeId) {
    console.warn('[SEND-EMAIL] freeze_completed called without freeze data - possible bug');
  }
  // ... rest of template
```

#### Step 3: Search for Hidden Invocations
Add detailed logging to track where email invocations originate from, by passing a `source` parameter in all email calls.

### Technical Details

**Files to modify:**
1. `supabase/functions/send-email/index.ts` - Add logging and validation for freeze_completed
2. All edge functions will be redeployed to sync with repo

**Expected outcome:**
- The mystery freeze_completed email should stop being sent during activation
- If it continues, the new logging will reveal the source

### Edge Cases and Considerations
- This might be coming from an external webhook or service we don't control
- The Resend email service might have queued/scheduled emails from a previous version
- A cron job might be invoking an outdated function

