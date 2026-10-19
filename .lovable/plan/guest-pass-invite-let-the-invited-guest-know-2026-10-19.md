# Guest pass invite: let the invited guest know

## How it works today
1. Staff give a member a complimentary guest pass.
2. The member signs in to their portal and goes to **Credits**. They see a "Complimentary Guest Pass" box.
3. The member types in the guest's name, email, phone and visit date, then taps **Register Guest**.
4. The guest is now on the list for that day. The front desk finds them by name when they arrive.

The guest never gets an email or text. They only learn about the visit if the member tells them.

## What we'll change
- **The guest gets an email when they're registered.** It has the member's name ("Sarah invited you to Storm Wellness Club"), the visit date, the club address and hours, and a link to sign the waiver before they come.
- **The guest gets a text with the same details**, but only if that phone number has agreed to texts. Carrier rules don't allow texting anyone else.
- **The member's confirmation will say** "We've sent [guest] an invitation."
- **New wording.** The box will say "You have a complimentary guest pass" instead of "free guest pass."

## Technical details
- After `redeem_guest_pass_credit` succeeds in `GuestPassRegistrationCard` (src/pages/member/Credits.tsx), call `send-email` with a new `guest_pass_invite` template. The waiver link is the existing guest waiver/sign-up flow, with the email pre-filled.
- SMS goes through `send-sms` with the normal consent checks and no bypass.
- Copy fix on the card description.
- No change to how passes are granted, redeemed or checked in.
