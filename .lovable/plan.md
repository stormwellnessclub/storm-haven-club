
# Aggressively fix all 281 warn-level security findings

All findings are Supabase linter `warn` — no criticals. Fix in 4 staged DB migrations so each stage can be verified before the next lands. After each migration I re-run the scanner and mark cleared findings fixed.

## Stage 1 — `function_search_path_mutable` (safest, ~majority of findings)

Add `SET search_path = public` (or `public, pg_temp` for SECURITY DEFINER) to every `public.*` function missing it. Pure hardening — no behavior change.

- Query `pg_proc` to enumerate every public function whose `proconfig` lacks `search_path`.
- Emit `ALTER FUNCTION public.<name>(<args>) SET search_path = public` for each.
- No app code touched.

## Stage 2 — Public storage bucket listing (3 findings)

For each public bucket flagged (likely `member-photos`, `equipment-images`, `cafe-menu`-style — I'll confirm from `storage.buckets`):

- Keep bucket public for direct URL reads.
- Replace broad `storage.objects` SELECT policy with one that allows anon `SELECT` **only when a specific object name is requested** by removing the list-all policy and relying on direct URL access, OR narrow the SELECT policy `USING` clause to `false` for anon while keeping objects reachable via signed/public URLs.
- Verification: `curl` a known object URL still works after migration.

## Stage 3 — `rls_policy_always_true` on writes (3 findings)

Enumerate policies where `cmd IN ('INSERT','UPDATE','DELETE','ALL')` and `qual = 'true'` or `with_check = 'true'`. For each:
- If the table is admin/service-only → replace `true` with `has_any_role(auth.uid(), ARRAY['super_admin','admin','manager'])`.
- If it's an ownership table → replace with `auth.uid() = user_id`.
- I'll list each policy in the migration description before running so you can veto any that should stay open.

## Stage 4 — SECURITY DEFINER EXECUTE lockdown (largest, highest risk)

Two lint IDs: anon-executable and authenticated-executable SECURITY DEFINER functions.

Approach: **default-deny, allow-list the intentionally public ones.**

1. Enumerate all `public.*` SECURITY DEFINER functions.
2. Build an allow-list of functions that MUST stay callable by anon/authenticated because the app depends on them:
   - `has_role`, `has_any_role`, `current_user_email_lower`
   - `process_member_scan`, `kiosk_search_visitors`, `kiosk_check_in_*`
   - `submit_class_review_for_booking`, review submission RPCs
   - Booking/credit atomic RPCs called from member portal (`book_class_*`, `cancel_class_booking`, `redeem_*`, `apply_*`)
   - `handle_new_user` / trigger-only functions (leave untouched — triggers don't need EXECUTE grants)
   - Any function referenced by non-staff client code (I'll grep `supabase.rpc(` across `src/`)
3. For every other SECURITY DEFINER function:
   - `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;`
   - `GRANT EXECUTE ... TO service_role;` (and staff role via `has_any_role` check inside function, if needed).
4. Print the full revoke/keep table in the migration description before running.

Risk: revoking EXECUTE on a function the client actually calls will break that feature. Mitigation: I audit `supabase.rpc(...)` and known trigger uses first, and stage this migration last so earlier fixes aren't blocked.

## Verification loop

After each stage: re-run `security--run_security_scan`, confirm the target category count drops to 0 (or a known allow-listed remainder for Stage 4), then `manage_security_finding` → `mark_as_fixed` for each cleared internal_id. If any app flow breaks, roll back with a compensating migration.

## What I will NOT touch

- `supabase/config.toml`, `auth`, `storage`, `realtime`, `supabase_functions`, `vault` schemas.
- Auto-generated `src/integrations/supabase/*`.
- Any function whose behavior is exercised only by staff and already gated at RLS level — hardening only, no logic changes.

## Rough size

- Stage 1: ~1 migration, dozens of `ALTER FUNCTION` lines.
- Stage 2: 1 migration, 3 policy edits.
- Stage 3: 1 migration, 3 policy edits.
- Stage 4: 1 migration, potentially ~60–100 `REVOKE/GRANT` lines plus an allow-list comment block.

Approve to switch to build mode and I'll start with Stage 1.
