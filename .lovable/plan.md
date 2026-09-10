# Security fixes + 2-week notice for freeze requests

Two pieces of work: close every open security alert, and require freeze requests to be made at least 14 days before the start date.

## 1. Security alerts

### Staff cancellation-notice preview runs member-supplied HTML
A member could type hidden code into their own first name, and it would run inside a staff member's browser when the cancellation notice is opened. Fix: clean the preview text before it is displayed, and escape name/merge values.

### Members can edit their own money fields
Several tables let a signed-in person send a direct update to their own row and change amounts, credits, statuses or payment references:

- Café orders — order total, items, status, payment reference
- Class bookings — credits used, amount paid, payment method, admin hold
- Class passes — sessions remaining/total, expiry, price paid, status
- Class waitlist — credits used, pass link
- Kids care bookings — status, pass, check-in fields
- Personal training appointments — amount due, payment status, package deduction
- Spa appointments — amount paid, tip, add-on total, payment reference

Fix: each of these tables gets a database guard that allows only the harmless self-service changes (cancelling, leaving a waitlist, personal notes) and rejects any change to money, credit, or payment fields. Staff, admin screens, and the automatic payment/webhook flows keep full access. Where a guard already exists (class passes, PT, spa), the matching access rule is tightened so the protection is visible in the rule itself, not just the guard.

### Database functions without a fixed search path
Set an explicit search path on the flagged functions so they can't be redirected.

Each finding is re-checked after the change and marked fixed.

## 2. Freeze requests need 2 weeks' notice

Member side (`/member/freeze`):
- The date picker only allows start dates 14 or more days out (Detroit time).
- Text under the date field explains the 2-week notice requirement.
- The request is re-checked on submit so an old page can't slip through.

Database:
- A guard on `member_freezes` rejects member-created requests with a start date under 14 days away, so the rule can't be bypassed by calling the API directly.
- Staff-created rows are exempt.

Staff side (admin freeze screens):
- If a start date is under 14 days away, a warning appears explaining the notice policy, but staff can continue and save it.

## Technical notes

- Guards use the existing `public.is_privileged_row_writer()` and `public.changed_columns(old, new)` helpers already used by earlier fixes, applied as `BEFORE UPDATE` triggers plus tightened `WITH CHECK` clauses.
- Freeze lead time constant lives in one shared place used by the member page, the admin dialog, and mirrored by the database trigger (14 days, `America/Detroit`).
- Preview sanitisation uses DOMPurify, matching `AnnouncementsTab` and the other template previews.
- Findings closed with the security finding tool after verification.
