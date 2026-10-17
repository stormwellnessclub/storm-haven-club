# Notify clients when their spa request is booked

## Today
When staff book a request, the client gets a confirmation email and text only if they have an account. People who send a request without an account get nothing.

## Change
- When staff press "Book this request" and save, the client always gets a confirmation, account or not, unless staff untick "Send confirmation email / text".
- **Email** goes to the email on the request. It includes the service, day, time and the Storm Wellness Club address. For Body Wraps it also has the "Complete Body Wrap Intake" button.
- **Text** goes to the phone on the request, but only if that number has agreed to texts. If it hasn't, only the email goes out.
- Each booking sends one confirmation at most, even if staff save twice.
- The request card shows "Client notified" with the time it was sent.
- Requests marked Declined or Contacted send nothing to the client.

## Technical details
- In AdminSpaBookingModal, when there is no linked user id but prefill or walk-in email/phone exists, call the existing spa confirmation sender with the contact details instead of skipping it.
- The intake link for account-less clients uses a signed per-appointment token. It reuses `spa_review_tokens` or a similar token, so the form opens without signing in.
- Texts go through send-sms with no consent bypass. The idempotency key is `spa-confirm-${appointmentId}`.
- Store `notified_at` on spa_service_requests.
- No test sends go to real clients. Verification uses a staff address.
