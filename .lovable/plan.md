
Fix the check-in system so unpaid/declined members are hard-blocked and clearly labeled everywhere staff uses it.

What’s broken now
- `/admin/check-in` is bypassing the backend guard and inserts directly into `check_ins` from the client. That means staff can still check someone in even when billing should block them.
- The manual check-in page uses `checkMemberPaymentStatus(...)`, but that helper is too loose for this job:
  - it treats any `stripe_subscription_id` as active
  - it ignores `subscription_status` failures like `incomplete`
  - it does not consistently use the same rules as the scanner/backend
- `/admin/scanner` already uses `process_member_scan`, but the override path can still admit billing-blocked members, and the UI does not surface the denial reason strongly enough.

Implementation plan

1. Make the backend the single source of truth for check-in eligibility
- Update the backend check-in logic in `process_member_scan` so it is the one definitive gate for:
  - recent failed payment
  - dues `past_due`
  - missing or incomplete subscription
  - annual fee overdue/unpaid
  - pending activation
- Return richer denial details in the RPC response so the UI can show exactly why access is denied.
- Tighten override behavior so billing-related denials cannot be overridden. If someone owes money or had a failed payment, the backend must refuse check-in even when staff clicks override.

2. Route every member check-in path through that backend gate
- Refactor `src/pages/admin/CheckIn.tsx` to stop writing directly to `check_ins`.
- Use the same RPC that the scanner uses, so manual search-based check-in and scanner check-in behave identically.
- Keep duplicate-check protection and audit logging, but move the final allow/deny decision to the backend only.

3. Make the blocked status obvious in the admin UI
- Update `src/pages/admin/CheckIn.tsx` to show a strong red “Cannot Check In” state with specific reasons such as:
  - Payment Failed
  - Monthly Dues Past Due
  - No Active Subscription
  - Annual Fee Overdue
- Remove the “Override Check-In” action for billing blocks.
- Add the effective billing badge directly in member search results so staff can see the problem before selecting the member.

4. Align scanner, badges, and member admin views
- Update `src/hooks/useMemberScanner.ts` typings to include the full billing denial payload returned by the backend.
- Update `src/pages/admin/Scanner.tsx` so denied scans clearly show the exact billing reason instead of a generic denial.
- Update `src/components/admin/EffectiveStatusBadge.tsx` and related billing issue helpers so the same labels appear consistently across:
  - scanner
  - check-in hub
  - members list
  - member detail / billing views

5. Remove the stale client-side billing logic drift
- Replace or rewrite `checkMemberPaymentStatus` and the current manual check-in-side payment checks so they no longer make independent access decisions.
- Keep client helpers for display only, but base them on the same rules/fields as the backend gate.

Files likely involved
- `src/pages/admin/CheckIn.tsx`
- `src/pages/admin/Scanner.tsx`
- `src/hooks/useMemberScanner.ts`
- `src/hooks/usePaymentStatus.ts`
- `src/hooks/useMembersBillingIssues.ts`
- `src/components/admin/EffectiveStatusBadge.tsx`
- backend migration updating `process_member_scan` (and possibly a small shared helper function for access evaluation)

Result after implementation
- Members with failed payments or money owed cannot be checked in from scanner or manual admin lookup.
- Staff sees the exact reason immediately.
- Billing-denied check-ins are enforced server-side, so the UI cannot accidentally bypass the rule again.
- Audit logs remain intact for denied attempts and any non-billing overrides.
