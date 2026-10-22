# Stop applications from saving twice

## Why it happens
Some applicants' submissions got saved twice, a fraction of a second apart. Today it happened to Fadia Akil (1 second apart) and Diana Bertoni (same instant). Back in April it happened to DeMarco Ward. Each person really did submit once, but the form saved the record twice. That happens when the Submit button gets tapped twice or the phone resends the request.

The form does check "do you already have an application?", but it checks on the applicant's phone before saving. Two saves that fire together both pass that check, so nothing on our side blocks the second one.

The other names that show twice (for example, an old cancelled application plus a new one months later) are real re-applications. Those stay as they are.

## What changes
1. **Block the second save on our side.** If a pending application already exists for the same email, the new one is refused. The applicant still sees their normal "application received" screen, so a double tap never shows them an error. Rejected or cancelled applications don't count, so re-applying still works.
2. **Lock the Submit button** the moment it's pressed, so a quick second tap does nothing.
3. **Clean up the 3 existing doubles** (Fadia Akil, Diana Bertoni, DeMarco Ward). For each one, keep the first record and remove the copy. I'll only do this after confirming the copy has no card, payment, notes or status history that the first record is missing.

## Technical notes
- Migration: a partial unique index on `lower(email)` in `membership_applications` where `status` is pending (one active pending row per email), plus a cleanup step that deletes the later duplicate row of each verified pair.
- `src/pages/Apply.tsx` submit: guard with a ref set synchronously before the insert. Treat a unique-violation error (23505) as success and log it via `logSubmitResult` as `duplicate`.
- Add a test that a unique-violation counts as a successful submit.
