## Clean up Agreements & Acknowledgments section

In `src/pages/admin/Applications.tsx`, the application detail view shows red X's on every applicant for fields their version of the form never asked. Fix by:

### Remove deprecated rows
- Drop **Credit Card Authorization** row (legacy `credit_card_auth`)
- Drop **Auth Acknowledgment** row (legacy `auth_acknowledgment`)
- Drop **Submission Confirmed** row (internal flag, false on all legacy records)

### Keep meaningful rows
- Membership Agreement Signed
- One-Year Commitment
- Initiation Fee Acknowledged
- Card-on-File Acknowledged
- Final Readiness Confirmed
- Liability Waiver (already shown in Membership section)

### Legacy applicant handling
For applications detected as legacy (`credit_card_auth === true && ack_initiation_fee === false`), replace the three new ack rows with a single neutral note:

> ✓ Acknowledged on legacy form

This avoids misleading red X's on the 160 older applicants while keeping accurate per-checkbox display for new submissions.

## Out of scope
- No database changes; legacy columns remain for historical record
- No form changes
