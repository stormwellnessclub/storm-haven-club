# Fix: Summer Daoud still blocked at check-in after paying

## What the database actually shows

For Summer Daoud (summerd1410@gmail.com):

- `members.status` = `past_due`
- `members.subscription_status` = `past_due`
- `payment_past_due` = false
- Zero unpaid rows in `billing_arrears` (all rows are `paid`)
- Zero rows in `payment_dunning_state`

So the money side is clean — the payment you took cleared the arrears and the dunning flag, but the two status columns were never flipped back. The check-in rule hard-blocks on both `members.status = 'past_due'` and `subscription_status = 'past_due'`, which is why the scanner still refuses her.

That means this is not a one-off: any member you collect from manually will stay locked out until someone edits their status by hand.

## Fix

### 1. Clear Summer now
Set her `status` back to `active` and `subscription_status` to `active` so she can check in today.

### 2. Make payment collection clear the block automatically
Add a `clear_member_past_due(member_id)` database routine that, when a member has no unpaid `billing_arrears` and no active dunning row:
- flips `members.status` from `past_due` to `active`
- flips `subscription_status` from `past_due`/`unpaid` to `active`
- sets `payment_past_due` = false
- writes an entry to `admin_action_log` so there's a trail

Call it at the end of every path that collects money against a member: the manual charge / arrears payment flow, the member self-serve retry, and the Stripe `invoice.payment_succeeded` webhook.

### 3. Catch drift on a schedule
Extend the existing membership-truth sync so it also repairs this mismatch: if a member is marked `past_due` locally but has no unpaid arrears, no dunning row, and a live subscription, it clears the block instead of only rewriting `subscription_status`. This is what catches anyone already stuck in the same state as Summer.

### 4. Sweep existing members
One pass over all members currently flagged `past_due` with no unpaid arrears and no dunning, clearing them the same way. I'll list who gets cleared before applying it.

## Technical notes

- New `SECURITY DEFINER` function `public.clear_member_past_due(uuid)`, granted to `service_role` and staff roles only.
- Hook points: `charge-member-arrears`, `retry-my-payment`, `stripe-webhook` (`invoice.payment_succeeded`), and the manual-charge completion path.
- `sync-membership-truth` gains a past-due reconciliation branch alongside its existing `statusFixes` logic.
- No schema changes to `members`; only status values and a new function.
