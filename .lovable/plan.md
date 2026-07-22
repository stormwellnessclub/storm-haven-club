# Fix: Freeze request fails with generic error

## Root cause (verified)

Two database objects reference a column that no longer exists on `billing_arrears`:

- Trigger `enforce_no_freeze_when_past_due` (fires BEFORE INSERT on `member_freezes`)
- RPC `check_freeze_block_status` (used by the portal to show the past-due banner)

Both do:
```
SUM(ba.outstanding_cents) FROM billing_arrears ba WHERE ba.outstanding_cents > 0 ...
```

But `billing_arrears` has no `outstanding_cents` column — only `amount_due_cents` and `amount_paid_cents`. Every freeze insert therefore throws a Postgres "column does not exist" error, which the client surfaces as the generic "Failed to submit freeze request" toast Deana is seeing. Her account is genuinely clean (0 arrears rows unpaid, subscription `active`), so she should be able to freeze.

## Fix

Single migration that replaces both function bodies to compute outstanding from the actual columns:

```
GREATEST(amount_due_cents - COALESCE(amount_paid_cents, 0), 0)
```

- `public.enforce_no_freeze_when_past_due()` — same logic, just swap the `outstanding_cents` references for the computed expression.
- `public.check_freeze_block_status()` — same swap so the portal past-due banner works again.

No schema changes, no RLS changes, no frontend changes. Behavior after fix: members with no unpaid arrears (like Deana) can submit freeze requests; members with a real outstanding balance still get blocked with the correct dollar amount.

## Verification

After the migration:
1. Re-run `check_freeze_block_status` as Deana → expect `blocked=false`.
2. Have Deana submit her freeze request again → should succeed.
