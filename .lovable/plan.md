# Booked spa requests: notify the client, then account + waiver

## Today
Anyone can send a spa request without an account. When staff book it, only people with an account get a confirmation. Everyone else gets nothing.

## Change
- **Requests stay open.** No account is needed to send one.
- **When staff book a request**, the client gets an email at the address they gave, plus a text if that number has agreed to texts. Staff can untick "Send confirmation email / text" to skip it.
  - If they **already have an account**, it's the normal confirmation. For Body Wraps it includes the "Complete Body Wrap Intake" button.
  - If they **don't have an account**, the email says their appointment is booked. They must finish two steps before the visit, with one button: **create your account** (the email is already filled in) → **sign the liability waiver**. After that, the intake form shows in their profile under Forms. For Body Wraps, the intake comes next.
- **The appointment joins their new account automatically** when they sign up with the same email. They see it under their bookings.
- **Staff can see what's missing.** On the appointment and the request card: "Account needed", "Waiver needed" or "Intake needed" until each is done. The card also shows "Client notified" with the time.
- Each booking sends the confirmation once, even if staff save twice. Declined or Contacted requests send nothing.

## Technical details
- In AdminSpaBookingModal, when there is no linked user, still send the confirmation using the email/phone from the request or walk-in. Use a new "booked – finish setup" email variant through the existing spa notification path, not a marketing email.
- Sign-up link: `/auth?mode=signup&email=…&redirect=/waiver?next=/profile#forms`. Add a step that links appointments to the user on profile creation, matching the lowercased email on `spa_appointments` (alongside the existing auto-link triggers).
- Texts go through send-sms with no consent bypass. Idempotency key `spa-confirm-${appointmentId}`.
- Add `notified_at` to spa_service_requests. Account/waiver/intake status comes from existing waiver and intake status checks.
- Testing uses a staff address only. No sends go to real clients.
