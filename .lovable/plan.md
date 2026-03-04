

# Fix: Add "End Freeze Early" for Active Freezes

## The Situation

You manually changed the member's status back to active so she could check in, but the freeze record in the system still shows as "active." There's no button on the Active tab to close out a freeze early — so you're stuck with a contradictory state.

## What This Will Add

An **"End Freeze Early"** button on every row in the Active freezes tab. Clicking it shows a confirmation dialog, and upon confirming it will:

1. Mark the freeze record as `completed` with today as the `actual_end_date`
2. Set the member's status to `active` (already done in your case, but safe to re-run)
3. Resume both Stripe subscriptions (monthly dues + annual fee) by calling `resume_subscription` via the `stripe-payment` edge function

This lets you immediately fix the current member's record, and gives you a proper tool for future situations.

## Changes

### 1. `src/hooks/useAdminFreezeRequests.ts` — Add `useEndFreezeEarly` hook

New mutation that:
- Updates freeze record: `status = 'completed'`, `actual_end_date = today`
- Updates member: `status = 'active'`
- Resumes Stripe subscriptions (both monthly and annual, if they exist)

### 2. `src/pages/admin/FreezeRequests.tsx` — Add button + confirmation dialog

- Import and wire up the new `useEndFreezeEarly` hook
- Add an "End Freeze Early" button in the Actions column for rows with `status === 'active'`
- Add a confirmation dialog warning that billing and access will resume immediately
- On confirm, call the mutation

### No database changes needed.

