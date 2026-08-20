---
name: Apply flow anonymous insert constraint
description: The public apply form inserts membership_applications while signed out — never read the row back or require columns the form doesn't send
type: constraint
---
- `src/pages/Apply.tsx` submits `membership_applications` as an anonymous (signed-out) user. The insert policy allows `user_id IS NULL`, but the SELECT policy only allows the owner or staff.
- NEVER add `.select(...)`/`return=representation` to that insert: Postgres runs the RETURNING select-policy check and reports it as `new row violates row-level security policy`, blocking every public submit (regression Aug 18–20, 2026).
- Do not widen the SELECT policy to anon — applicant data must stay staff/owner-only.
- Any column the form can leave empty must be nullable or defaulted (`referred_by_member` was NOT NULL and was made nullable Aug 20, 2026).
- Failed submits are recoverable: `application_submit_attempts.payload` holds the full submitted row (logged by the `log-application-submit` edge function before the insert).
