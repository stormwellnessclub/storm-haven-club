## Fix waitlist hold refunds + promote-from-waitlist flow

### Problem
1. `process-expired-waitlist` cron is rejecting itself with 401 ("Invalid JWT token: missing sub claim"), so unclaimed waitlist holds never trigger `refund_waitlist_hold`. Members' passes stay stuck in a held/exhausted state (e.g. Eman Altairi).
2. Admin "Promote from waitlist" checks `class_passes` for `status = 'active'` only, so a held pass is invisible — the UI then forces the admin to pick a new payment method or "buy a pass".

### Changes

**1. Fix cron auth on `supabase/functions/process-expired-waitlist/index.ts`**
- The pg_cron job posts with the anon key in the `Authorization` header, but the current validator only accepts service-role, anon-exact-match, or a full user JWT. The anon-key branch works only if the header is byte-exact; pg_net occasionally sends it with different casing/whitespace, and the JWT branch then rejects it.
- Normalize the header, compare the bearer token (not the full header string) to both `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`, and only fall through to `auth.getUser()` when the token actually looks like a user JWT (has `sub`).
- Keep CORS + response shape identical.

**2. Backfill stuck holds**
- One-off migration/SQL: for every `class_waitlist` row where `status = 'notified'` and `claim_expires_at < now()`, call `refund_waitlist_hold(id)` and set `status = 'expired'`. This restores Eman's and any other stuck member's pass immediately.

**3. Promote-from-waitlist reuses the held pass**
- In `src/pages/admin/ClassRoster.tsx` (promote action) and `PaymentMethodSelector.tsx`:
  - When the selected attendee is a waitlist entry with an existing hold (`class_waitlist.hold_pass_id` / `hold_credit_id`), default the payment method to that held pass/credit and skip the picker.
  - Show a single line: "Using held pass — [category] 10-pack, N remaining after booking."
  - Add an "Override payment method" link that reveals the current selector for the rare case an admin wants to switch.
  - The promote RPC already consumes the hold; no backend change needed beyond ensuring the UI doesn't try to re-charge.

**4. Waitlist visibility (small)**
- In the admin waitlist panel, badge rows where `status = 'notified'` and `claim_expires_at < now()` as "Claim expired — refund pending" so stuck entries are obvious until the cron sweeps them.

### Out of scope
- Member-side cancellation refund logic (already correct).
- Schema changes to `class_waitlist` / `class_passes`.
- Schedule/UI redesign discussed earlier.

### Verification
- Curl `process-expired-waitlist` with anon bearer → expect 200 and processed count.
- Confirm Eman's `class_passes` row returns to `status = 'active'` with credit restored.
- Promote a waitlisted member in a test class → booking succeeds without a payment prompt.
