## Add "Undo / Reopen" for Cafe orders

Right now, cancelling or completing a cafe order in the Order Queue is a one-way action — there's no way to revert if a staff member misclicks. I'll add an undo path for both states.

### Behavior

In the Order Queue card (`src/pages/admin/CafePOS.tsx`):

- **Cancelled orders** → show a "Reopen Order" button that moves the order back to `pending`.
- **Completed orders** → show an "Undo Complete" button that moves it back to `ready`.
- Both buttons sit alongside the existing status badge in the card footer (same spot as the current Cancel/Complete buttons).
- Confirm with a small `AlertDialog` ("Reopen this cancelled order?" / "Move this order back to Ready?") to prevent accidental double-clicks.
- After undo, the card re-appears in the relevant filter (Pending / Ready) and a toast confirms the change.

### Visibility

- Cancelled and Completed filter tabs already exist, so undone orders naturally reappear in their new bucket.
- To keep the queue usable, only show undo on orders updated within the **last 24 hours** (older ones are considered closed). Older orders still appear but without the undo button.

### Technical notes

- Reuses the existing `useUpdateCafeOrderStatus` mutation — no new RPC needed.
- Need to tweak `useUpdateCafeOrderStatus` so that when transitioning **out of** `completed`, it clears `completed_at` back to `null` (otherwise the timestamp lies).
- No DB migration required; `status` already accepts all five values.
- No changes to customer-facing `MyCafeOrdersCard` — it filters by active statuses, so reopened orders will reappear there too automatically.

### Files touched

- `src/pages/admin/CafePOS.tsx` — add undo buttons + confirm dialog, show on cancelled/completed cards within 24h window.
- `src/hooks/useAdminCafeOrders.ts` — clear `completed_at` when status moves away from `completed`.
