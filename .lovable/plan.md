# Text messages for class, PT and spa cancellations

Rule going forward: whenever Storm Wellness Club cancels a class, PT session or spa appointment and sends an email, the person also gets a text (if their number has agreed to texts — STOP always wins). Membership and application cancellations stay email only.

## What's missing today

| Cancellation | Email | Text today |
|---|---|---|
| Staff cancels a whole class (Classes page) | Yes | **No** |
| Staff removes someone from a class (roster) | Yes | **No** |
| Personal Training session cancelled | Yes | **No** |
| Spa appointment cancelled | Yes | Yes, but uses class wording |
| Member cancels own class booking | Yes | Yes (no change) |
| Membership / application cancelled | Yes | No — stays email only |

## What changes

1. **Class cancelled by the club** — every booked person gets: "Storm Wellness Club: Your {class} on {date} at {time} has been cancelled by the studio. {credit note}". Credit note says "Your credit was returned." only when one was actually returned; comped spots get no credit line.
2. **Removed from a class by staff** — same text, same credit rule.
3. **PT session cancelled** — new text: "Storm Wellness Club: Your Personal Training session on {date} at {time} has been cancelled."
4. **Spa cancellation** — own wording: "Storm Wellness Club: Your {service} appointment on {date} at {time} has been cancelled."
5. New texts appear in the editable text wording screen like the others.

No texts are sent while building this; testing uses the "send test to my phone" button only.

## Technical details

- Add SMS templates `spa-appointment-cancellation`, `pt-session-cancelled`; change `class-cancelled` body to use `{{creditNote}}` instead of hardcoded "Credit refunded."
- `src/pages/admin/Classes.tsx` and `src/pages/admin/ClassRoster.tsx`: invoke `send-sms` (`to: { userId, phone }`) alongside each `class_cancelled_by_admin` email; idempotency `class-cancelled-{bookingId}`.
- `send-pt-booking-email`: on cancellation, also call `send-sms` server-side.
- `useSpaBooking.ts`: swap cancellation smsKey to the spa template.
- All sends via `send-sms` without bypassConsent. Small test mapping each class/PT/spa cancellation email to an SMS template (and asserting membership/application types have none). AGENTS.md rule recording that membership cancellations are email-only.
