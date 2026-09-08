# Class pass tampering — already blocked

This finding was fixed minutes ago, and I re-checked the live database just now to confirm it is still in force.

## Current state (verified)

The `class_passes` table has an active guard `trg_guard_class_passes_member_update` that runs on every update. For anyone who is not staff it:

- Allows only three fields to change: remaining sessions, pass status, and the updated timestamp.
- Blocks all money and entitlement fields — price paid, total sessions purchased, expiry date, payment reference, and who the pass belongs to.
- Refuses any update that would make remaining sessions higher than the number purchased.
- Limits status changes to active / used up.

Staff, admin tools, and the automated payment flows are unaffected.

A second, older guard (`guard_member_tamper_class_passes`) is also present on the table, so the protection is layered.

## Proposed action

No code or database change is needed. If you want extra assurance, I can:

1. Run a live check as a normal member account that tries to add sessions to a pass and rewrite its price, and show you both attempts being rejected.
2. Confirm that buying a pass, booking a class, and kids-care check-in still work end to end after the change.

Approve to run that verification, or skip if the confirmation above is enough.
