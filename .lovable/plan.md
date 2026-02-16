

## Add Admin Fee Waiver for Freeze Requests

### Current Stripe Behavior (Already Working)

The freeze activation already pauses both Stripe subscriptions (membership dues and annual fee) via the `pause_subscription` action in the `stripe-payment` edge function. When the freeze expires, the daily cron job (`process-freeze-expirations`) resumes both subscriptions. This is fully functional.

### The Problem

On the Freeze Requests page, after approving a request, the "Activate" button only appears if `fee_paid === true` (line 252). If the fee hasn't been paid, it shows "Awaiting Payment." There is no way for an admin to waive the $30 fee and activate the freeze directly.

### Changes

**1. Update `FreezeRequests.tsx` -- Add "Waive Fee & Activate" button**

For approved requests where `fee_paid` is false, add a second button alongside the "Awaiting Payment" badge:

- New button: "Waive Fee & Activate" (only visible to admin/super_admin roles)
- Clicking it opens a small confirmation dialog: "Waive the $30 freeze fee for [Member Name]? This will activate the freeze immediately without payment."
- On confirm, calls a modified `useActivateFreeze` that also sets `freeze_fee_total` to 0

**2. Update `useAdminFreezeRequests.ts` -- Accept `waiveFee` parameter**

Modify the `useActivateFreeze` mutation to accept an optional `waiveFee: boolean` flag:

- When `waiveFee` is true, set `freeze_fee_total` to 0 and `fee_paid` to true in the same update
- When `waiveFee` is false (default), keep existing behavior

**3. Role check in UI**

Import `useUserRoles` in `FreezeRequests.tsx` and only show the "Waive Fee" button to users with `admin` or `super_admin` roles.

### Technical Details

| File | Change |
|------|--------|
| `src/hooks/useAdminFreezeRequests.ts` | Change `useActivateFreeze` param from `string` to `{ freezeId: string; waiveFee?: boolean }`, set `freeze_fee_total: 0` when waiving |
| `src/pages/admin/FreezeRequests.tsx` | Add "Waive Fee & Activate" button with confirmation dialog for approved/unpaid requests; add role check via `useUserRoles` |

**Modified activation mutation signature:**

```typescript
// Before
mutationFn: async (freezeId: string) => { ... }

// After
mutationFn: async ({ freezeId, waiveFee = false }: { freezeId: string; waiveFee?: boolean }) => {
  // existing code...
  const updatePayload = {
    status: 'active',
    fee_paid: true,
    updated_at: new Date().toISOString(),
    ...(waiveFee ? { freeze_fee_total: 0 } : {}),
  };
  // rest stays the same (pause subscriptions, update member status)
}
```

**UI addition (inside the actions column):**

```text
[Approved + fee_paid]     --> [Activate] button (existing)
[Approved + !fee_paid]    --> "Awaiting Payment" badge + [Waive Fee & Activate] button (new, admin only)
```
