# Fix: applications fail with "violates row-level security policy"

## What's happening

Confirmed from the submit-attempt log: 8 failed submits today, all from oshanamandell1@outlook.com, all with the error `new row violates row-level security policy for table "membership_applications"`. No application has been created since Aug 18.

The cause is not the insert permission — applicants (not signed in) are still allowed to insert. On Aug 18, when submit-attempt logging was added, the insert was changed to also read the new row back (`.select("id")`) so the log could record the application id. Reading a row back is governed by the view policy, which only lets a signed-in owner or staff see an application. An anonymous applicant can't read their own row back, and Postgres reports that as the row-level-security error the applicant sees — even though the row itself was rejected, nothing gets saved.

## The fix

1. Stop reading the row back on submit. The insert goes back to a plain insert with no return of data, so the anonymous applicant path never touches the view policy.
2. Keep the submit-attempt breadcrumb intact — start before the insert, success/failure after. The success entry simply records success without the application id; the log already matches on email and time, and the id isn't needed for recovery.
3. Same check on the second application write path in the apply flow (the pending-payment/resume branch) so it can't hit the same problem.
4. Verify end to end by running the real apply flow signed out in a browser against a test email, confirming a row lands in `membership_applications` and the attempt log shows `succeeded`.

## Recovering the lost applicant

Oshana Mandell's full submitted payload was captured by the breadcrumb log. After the fix, her application will be created from that saved payload so she doesn't have to fill the form out again, and I'll confirm the card-on-file status carried over.

## Technical notes

- `src/pages/Apply.tsx`: revert the submit insert to `.insert(payload)` without `.select().maybeSingle()`; `logSubmitResult` called without `applicationId`.
- No database or policy change. The existing insert policy (`user_id IS NULL OR user_id = auth.uid()`) and the staff/owner view policy stay exactly as they are — widening the view policy to anon would expose applicant data and is not part of this.
- Recovery insert done with the data tool from `application_submit_attempts.payload` for the failed rows.
