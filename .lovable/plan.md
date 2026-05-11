## Booking confirmation + cancellation policy (classes)

**Heads up on the email channel:** The app already has a fully-working Resend-based email pipeline (`send-email` edge function) used for ~40 email types including `booking_confirmation` and `booking_cancellation`. Spinning up Lovable Emails in parallel would duplicate infrastructure and split sender reputation. This plan **extends the existing email pipeline** instead — same domain (`notify.stormwellnessclub.com`), same "Storm Wellness Club Team" voice, no new DNS work. If you specifically want to migrate everything to Lovable Emails later, that's a separate, larger project.

### Cancellation policy (locked in)
> **Free cancellation up to 24 hours before class. Late cancellations forfeit your credit or pass.**

Used verbatim in: booking modal, cancel confirmation dialog, booking confirmation email, cancellation email, and a "View policy" link on the Book Class screen.

### 1. In-app booking confirmation (members + non-members)
- Replace the plain `toast.success("Class booked successfully!")` in `useBooking.ts` with a richer success state: a confirmation **dialog/sheet** that shows
  - Class name + date + time
  - Room (e.g. "Reformer Studio")
  - Instructor
  - **Remaining credits** (queries `useUserCredits` after the booking invalidation runs — shows "3 class credits remaining" or "Unlimited" for unlimited tiers)
  - Cancellation policy text
  - Buttons: "View my bookings" → `/member/bookings` or `/portal/bookings`; "Done"
- Falls back to a richer sonner toast if the dialog can't open (edge case where booking is invoked from a non-modal path)
- Component: `BookingConfirmationDialog.tsx` rendered from `BookingModal.tsx` on success — same pattern for member and non-member because both use `BookingModal`

### 2. Booking confirmation email — extend, don't replace
In `supabase/functions/send-email/index.ts`, the existing `booking_confirmation` case:
- Accept new optional fields in `data`: `remainingCredits` (number | "unlimited" | null), `creditLabel` ("class credits" / "passes remaining")
- Add a "Credits remaining" row to the details table (only when value is provided)
- Append a styled "Cancellation Policy" block above the footer with the locked-in wording and a "Manage your bookings" link to `/member/bookings`
- `useBooking.ts` passes the remaining credits computed after the RPC returns (from the `user-credits` query refresh or from the RPC return value if available)

### 3. Cancellation flow
- **Cancel confirmation dialog** (`src/pages/member/Bookings.tsx`, `src/pages/portal/Bookings.tsx`, `src/pages/MyBookings.tsx`):
  - Always show the full policy text (currently only shows when late)
  - Late path keeps the existing red warning + "Cancel Anyway"
  - On-time path shows: "Your credit or pass will be refunded immediately." + policy
- **Cancellation email** (`booking_cancellation` already exists — confirm it does, otherwise add it):
  - Include class name, date, time, room
  - State whether the credit/pass was refunded or forfeited (driven by the same `isLateCancel` server logic via RPC return)
  - Include the policy text for reference
  - Send from `useCancelBooking` `onSuccess` (calling `send-email` with `type: "booking_cancellation"`)

### 4. Policy visibility on Book Class
- The `Cancellation Policy` `Alert` already exists in `BookingModal.tsx` for members and non-members — keep it
- Add a small inline "Cancellation policy" link in the Book Class page header (`/member/book/class`, `/portal/book/class`) that opens a popover with the same wording — so users see it before clicking into a specific class

### Files touched
- `src/hooks/useBooking.ts` — pass `remainingCredits` to `send-email`; trigger confirmation dialog + cancellation email
- `src/components/booking/BookingModal.tsx` — render `BookingConfirmationDialog` on success
- `src/components/booking/BookingConfirmationDialog.tsx` *(new)* — in-app confirmation UI
- `src/components/booking/CancellationPolicyText.tsx` *(new)* — single source of truth for the policy string + tiny popover component
- `src/pages/member/Bookings.tsx`, `src/pages/portal/Bookings.tsx`, `src/pages/MyBookings.tsx` — show policy in cancel dialog (all 3 places)
- `src/pages/member/BookClass.tsx`, `src/pages/portal/BookClass.tsx` — header link to policy popover
- `supabase/functions/send-email/index.ts` — extend `booking_confirmation` template; ensure `booking_cancellation` template includes policy + refund/forfeit status (add the case if it doesn't already exist)

### Out of scope
- No DB schema changes (no new tables / RPC signatures)
- No Lovable Emails migration (uses existing Resend-based `send-email`)
- No changes to Spa or Kids Care confirmation / cancellation copy
- No changes to credit-deduction / refund business logic — only display + messaging

### Open question
You picked "Lovable Emails (built-in)" but the project already has a complete Resend pipeline. Confirm that **extending the existing email system** is OK; otherwise I'd need a separate, larger migration plan to move everything (auth emails, all 40+ transactional templates) onto Lovable Emails before doing this work, which is significantly more involved.
