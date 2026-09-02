# Early Closing Notice — Tonight, 9:00 PM

An email announcing that Storm Wellness Club closes at 9:00 PM tonight (Wednesday, September 2) for urgent maintenance. Nothing gets sent — this build only gives you a preview and a test-to-yourself option, with the "send to all members" button available for later if you decide to use it.

## What the email says

**Subject:** Closing early tonight at 9:00 PM — urgent maintenance

Body, in the existing Storm house style (cream header bar, gold rule, serif type, dark footer):

- Eyebrow: AN IMPORTANT UPDATE
- Headline: Closing Early Tonight at 9:00 PM
- Subline: Wednesday, September 2 — urgent maintenance
- Greeting by first name ("Hi Sarah," / "Hello," when no name on file)
- Highlighted box: the club will close at **9:00 PM tonight** instead of the usual time so our team can complete urgent maintenance. Please plan to wrap up your workout, class, or recovery session and exit the building by 9:00 PM.
- Line noting all classes, spa, recovery, and café service end before close, and that anyone with a booking affected will be contacted directly.
- Reassurance that we reopen on the normal schedule tomorrow morning.
- Thank-you for the short notice, signed "The Storm Wellness Club Team"
- Footer with admin@stormwellnessclub.com

## How you'll use it

1. Admin → Communications: a new "Tonight's Early Closing (9:00 PM)" card.
2. **Preview email** — opens the exact rendered email in a window.
3. **Send test** — sends only to the address you type (defaults to stormfitnessllc@gmail.com).
4. **Send email blast** — behind a confirmation dialog, one email per active member with an email on file. Re-running skips anyone already sent. I will not press this.

## Technical notes

- New edge function `send-closing-tonight-blast`, copied from the existing `send-july-23-maintenance-blast` pattern: `requireStaff(['admin','super_admin'])`, `preview` / `testEmail` / blast modes, Resend send from `admin@stormwellnessclub.com`, idempotency and logging in `email_audit_log` under `email_type = 'closing_early_2026_09_02'`.
- New `src/components/admin/ClosingTonightBlastControls.tsx`, mirroring `MaintenanceBlastControls.tsx`, mounted on the Communications admin page.
- All dates/times stated in America/Detroit. No database schema changes.
