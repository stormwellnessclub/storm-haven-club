# Open security issues (verified today)

Four real issues are open. I checked each one against the actual code and database rather than trusting the scan text — one of the scanner's claims was wrong and one it missed.

## 1. Staff pay rates and contact info readable by any logged-in user (highest priority)

The `instructors` table has a table-wide read grant for signed-in users. Column-level restrictions exist, but a table-wide grant overrides them, so any member with an account can query instructor `email`, `phone`, `hourly_rate`, and `default_per_class_rate` straight from the API.

Note: the scanner blamed anonymous visitors. That part is wrong — anonymous access is correctly limited to name, bio, photo, and specialties. The exposure is to logged-in users.

Fix: revoke the table-wide read grant and keep only the safe-column grants for signed-in users, matching how `spa_therapists` is already locked down. Staff and admin reads keep working through their existing role-based policies.

## 2. Anyone can email PT clients a fake "session recap"

`send-pt-booking-email` has no caller check at all. Anyone who supplies a valid appointment ID can send a branded Storm Wellness Club email — correct trainer name, real appointment details — with attacker-written recap and homework text, to that member's real inbox.

Fix: require a staff login (or the appointment's own member) before the function sends anything, matching the auth pattern already used across the other functions.

## 3. Backup SMS webhook accepts forged messages

`twilio-inbound` verifies Twilio's signature. Its backup, `twilio-fallback`, does not — it writes whatever phone number and message text a caller sends into the SMS log.

Fix: apply the same signature verification to the fallback before it writes to the database, and reject anything that fails.

Impact if left: fabricated inbound texts in the log staff rely on for opt-out and A2P compliance records.

## 4. Paid exercise API key is visible in the public website code

`src/lib/exercisedb.ts` calls the ExerciseDB API directly from the browser using a key baked into the shipped JavaScript. Anyone viewing the page source can copy it.

Fix: move those calls behind an edge function that holds the key server-side, then rotate the key. This mirrors the fix already applied to the Technogym integration.

## Not issues (no action)

- Members can't read `member_billing_snapshot` — that's intentional and fail-closed.
- Spa therapist pay rates — already correctly restricted; I confirmed the grants.
- Two generic database-linter warnings about SECURITY DEFINER functions — these are the expected shape for the kiosk and front-desk RPCs, which each enforce their own role checks internally.

## Suggested order

1 and 2 first (real data exposure and a phishing vector), then 3, then 4.

## Technical detail

- Item 1: `REVOKE SELECT ON public.instructors FROM authenticated;` then `GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, is_master, user_id, created_at, updated_at) ON public.instructors TO authenticated;`. Verify afterwards with `aclexplode` that no table-level SELECT entry remains, and confirm the admin instructor screens still load `email`/`phone` through their staff-role path.
- Item 2: add `requireStaff` from `supabase/functions/_shared/`, falling back to allowing the appointment's own `auth.uid()`; return 401 otherwise.
- Item 3: lift the HMAC-SHA1 validation block from `twilio-inbound/index.ts` (around line 74) into `twilio-fallback/index.ts`.
- Item 4: new `exercisedb-proxy` edge function reading the key from `Deno.env`; `src/lib/exercisedb.ts` calls it via `supabase.functions.invoke`; drop the `VITE_` vars.
