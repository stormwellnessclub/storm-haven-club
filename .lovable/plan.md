## Goal
Guarantee that only admin/manager/super_admin (and front_desk where already granted) can mark failed charges as resolved — never members from the portal.

## Current state (verified)
- **Portal** (`src/pages/portal/PaymentHistory.tsx`): no "Resolve" button, no update calls to `payment_attempts` or `manual_charges`. Read-only history with expandable details only.
- **Admin resolve hook** (`src/hooks/useMemberConfirmedIssues.ts`): used exclusively by `src/components/admin/MemberDetail/ConfirmedPaymentIssues.tsx` (admin surface).
- **Admin Failed Payments** (`src/pages/admin/FailedPaymentsHistory.tsx`): admin-only route.
- **RLS enforces this at the DB layer**:
  - `payment_attempts` UPDATE → only `super_admin | admin | manager | front_desk`.
  - `manual_charges` UPDATE → only `super_admin | admin | manager`.
  - Members have SELECT-only policies on both tables.

So even if a client bug added a resolve button in the member portal, the database would reject the write.

## Changes
1. **No code changes required** — the current implementation already satisfies the rule.
2. **Save a project memory rule** at `mem://security/billing/resolve-admin-only` so future edits don't accidentally add a member-facing "Mark resolved" action:
   - Only admin/manager/super_admin (and front_desk on `payment_attempts`) may write `resolved_at`, `resolved_by`, `resolution_note`.
   - Member portal surfaces (`src/pages/portal/**`, `src/components/portal/**`) must be read-only for `payment_attempts` and `manual_charges`.
   - Do not add UPDATE policies for members on either table.
3. Add a one-line reference to this rule in `mem://index.md` under Memories.

## Verification after build-mode approval
- `rg` the portal directories for any `update.*payment_attempts|update.*manual_charges|resolved_at` — expect zero hits.
- Re-check `pg_policies` for `payment_attempts` / `manual_charges` UPDATE policies — expect no member-scoped policy.
