---
name: Access Control Status
description: process_member_scan RPC enforces un-overridable billing blocks including frozen, unpaid, and payment_past_due
type: feature
---
The `process_member_scan` RPC delegates to `evaluate_member_check_in_eligibility`, which hard-blocks (un-overridable) on:

- `members.status` in (cancelled, expired, suspended, frozen, pending_activation, past_due)
- `members.payment_past_due = true` (Batch 6 — surfaces dunning state at scanner; reason code `payment_past_due`)
- `subscription_status` in (past_due, unpaid, canceled, incomplete_expired) for non-cash billing
- Any unresolved row in `billing_arrears` (membership/dues only — cafe/spa POS declines do NOT block)

Frontend scanner formats `denial_reason` by replacing underscores with spaces; `payment_past_due` renders as "payment past due".
