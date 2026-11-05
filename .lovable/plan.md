# One approval email per new member

## What actually happened with Jessica
Only **one** approval email went out to her. The history shows it twice because two separate places recorded the same send: the sending service logs it once, and the approval letter screen logs it again a split second later. Every personalized approval letter has been showing up twice in email history.

## Changes
1. **Record each approval letter once.** The approval letter screen stops writing its own extra history entry. The single entry from the sending service now also keeps the application it belongs to, who sent it, and the custom letter text, so nothing is lost.
2. **Block real duplicate sends.** If an approval letter for the same application was already sent in the last 10 minutes, a second send (a double tap, or two staff at once) is skipped and staff see "Approval letter already sent." Resending on purpose later still works.
3. **Clean up history:** remove the extra duplicate history entries for past approval letters (the ones from the approval screen that match a send-service entry within a few seconds), so counts and the applicant's email history are correct.

## Technical details
- `PersonalizedLetterModal.tsx`: drop the client `email_audit_log` insert; pass `applicationId` and `triggeredBy` in `data`.
- `send-email`: for `approval_letter_personalized`, check `email_audit_log` for the same application or recipient within 10 minutes and return `{ success: true, skipped: 'duplicate' }`; include `application_id`, `triggered_by` and `custom_content` in its audit insert. Redeploy.
- One-time cleanup of paired `admin_personalized_letter` rows (same recipient, within 5 s of a `send-email-function` row), copying `application_id` onto the kept row first.
