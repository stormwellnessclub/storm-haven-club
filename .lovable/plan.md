
## Step 1 — Send the approved email to Lyan (now)

Add a small one-off `custom_message` case to the existing `send-email` edge function so we can send arbitrary admin messages without spinning up a new function. Then invoke it once with the approved copy below.

**Send parameters:**
- To: `lyan.mashrah@gmail.com`
- From: `Storm Wellness Club <admin@stormwellnessclub.com>` (already the default sender)
- Reply-To: `admin@stormwellnessclub.com`
- Subject: `Your Saturday reformer class — quick change + we need your phone number`

**Body (exactly as approved):**

> Hi Lyan,
>
> Welcome to Storm Wellness Club, and thank you for booking your first reformer class with us!
>
> **Two quick things:**
>
> **1. Tomorrow's 11:00 AM reformer class is being moved to 12:00 PM.**
> Just reply to this email and let us know which you'd prefer:
>  • **Move me to the 12:00 PM class**, or
>  • **Credit the class back to my account** so I can book another time
>
> **2. We don't have a phone number on file for you.**
> We use it for class reminders, waitlist alerts, and any last-minute schedule changes (like this one). Please reply with your best mobile number so we can add it to your account.
>
> Sorry for the shuffle, and we're excited to have you in the studio.
>
> Warmly,
> The Storm Wellness Club Team
> admin@stormwellnessclub.com

I'll log the send to `email_audit_log` (the function already does this) so we have a record.

## Step 2 — Require phone number on ALL bookings (new + existing accounts)

- New shared hook `usePhoneOnFile()` reads phone from `members` → `non_member_profiles` → `profiles`.
- Add an inline "Add your mobile number to continue" gate to every booking surface before confirm:
  - `BookingModal` (classes)
  - `SpaBookingModal` (spa)
  - `KidsCareBookingModal` (kids care)
  - Wellness credit-booking dialog (Red Light / Cryo)
- Save writes to `non_member_profiles.phone` + `profiles.phone` (and `members.phone` if applicable), then the booking flow continues automatically.
- Add required Phone field to signup (`src/pages/Auth.tsx` + `AuthContext.signUp`), written to `profiles.phone` on account creation.
- Existing `PortalPhoneGate` stays as a safety net.

## Step 3 — Handle Lyan's reply

- When she emails back: I'll write her number to `non_member_profiles.phone` + `profiles.phone`, and either move her booking to the 12:00 PM session or refund the credit per her choice.

## Files touched

- `supabase/functions/send-email/index.ts` (add `custom_message` case)
- `src/hooks/usePhoneOnFile.ts` (new)
- `src/components/booking/BookingModal.tsx`
- `src/components/booking/SpaBookingModal.tsx`
- `src/components/booking/KidsCareBookingModal.tsx`
- Red Light / Cryo booking dialog
- `src/pages/Auth.tsx`
- `src/contexts/AuthContext.tsx`
