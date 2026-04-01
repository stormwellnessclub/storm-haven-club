

# Schedule Downgrade for Next Billing Cycle

## Current State
The admin TierChangeDialog already has proration options, but all three ("Create Prorations", "No Prorations", "Invoice Immediately") change the tier **immediately** in both Stripe and the database. There's no way to defer a downgrade to the next billing cycle.

## Approach
Store a "pending tier change" in the database. When the next billing cycle arrives (detected via Stripe webhook on `invoice.paid`), automatically apply the tier change at that point.

## Implementation

### 1. Add pending tier change columns to `members` table
- `pending_tier_change` (text, nullable) — the new tier to switch to
- `pending_tier_change_at` (timestamptz, nullable) — when the change was scheduled
- `pending_tier_change_by` (uuid, nullable) — admin who scheduled it

### 2. Update TierChangeDialog with "Schedule for next cycle" option
- Add a new toggle/option: **"Apply at next billing cycle"** — visible only for downgrades with active subscriptions
- When selected, instead of calling `admin_update_member_tier`, save the pending change to the database and show a success toast
- Skip the Stripe subscription update entirely at this point

### 3. Show pending change indicator on Member Detail page
- Display a banner/badge when a member has a pending tier change
- Include a "Cancel Pending Change" button so admins can revoke it before it takes effect

### 4. Apply the change in the webhook
- In `stripe-webhook` handler, on `invoice.paid` events for membership subscriptions, check if the member has a `pending_tier_change`
- If so, call the same Stripe subscription update logic (swap price, update metadata) and update the database tier, then clear the pending fields
- This ensures the new price kicks in exactly when the new billing period starts

### 5. Update `useUserMembership` hook
- Add `pending_tier_change`, `pending_tier_change_at` fields to the interface so the member detail page can display pending status

### Files to change
- **Database migration** — add 3 columns to `members`
- `src/components/admin/TierChangeDialog.tsx` — add "schedule for next cycle" option for downgrades
- `src/pages/admin/MemberDetail.tsx` — show pending tier change indicator with cancel action
- `supabase/functions/stripe-webhook/index.ts` — apply pending tier change on `invoice.paid`
- `src/hooks/useUserMembership.ts` — add pending fields to interface

