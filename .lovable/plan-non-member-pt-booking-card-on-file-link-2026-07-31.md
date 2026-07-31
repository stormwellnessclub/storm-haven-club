# Non-member PT booking + card-on-file link

Two things: let non-members be booked into personal training from their account, and fix the "send link to add card on file" so the card actually comes back to us.

## 1. Does the card-on-file link work today?

Partly. Here's what happens now:

- The link is a real Stripe hosted card-setup page tied to that person's Stripe customer, so when they enter a card it IS saved on their Stripe customer. That part works.
- What does NOT work reliably: getting the card back into our system. The card details (brand / last 4 / expiry) only land on the non-member's record if that person, after saving the card, gets bounced back into the member portal **while logged into their own account**. If they open the emailed link on their phone, add the card, and land on a login screen (very common), nothing syncs. Their profile still shows "no card on file", and staff can't charge them at the desk.
- Nothing in the Stripe webhook writes cards back to non-member profiles (it only handles members and applicants), so there's no safety net.

### Fix

- Handle non-member card saves in the Stripe webhook: when a card setup succeeds for a customer that belongs to a non-member profile, write brand / last4 / expiry onto that profile and set the card as the Stripe customer default. This makes the link work no matter where the person opens it or whether they're logged in.
- Add an admin-side "Refresh card from Stripe" action on the non-member profile so staff can pull the latest card immediately without waiting.
- Track link status: show on the non-member profile when the link was last sent and whether it's been completed, using the existing card-setup attempts log.
- Send the person back to a friendly confirmation page after saving instead of a login-gated portal page.

## 2. Book a non-member for personal training

- Add a **Book PT Session** button on the non-member account page (and the quick-view side sheet) that opens the existing PT booking dialog pre-filled with that person.
- Make the PT booking dialog's customer search also look up non-member accounts, so staff can find them by name/email from the PT schedule page too, with a "Non-member" tag next to the name.
- Sell/grant PT packs to non-members: today booking is blocked with "no active sessions — sell a pack first". Add the same Sell PT Pack action that exists on member profiles to the non-member profile, including charging their card on file (which is why item 1 matters), plus a comp/manual option.
- Show the non-member's PT packs and upcoming/past PT appointments in their Passes & Bookings tab.

## Technical notes

- `setup_intent.succeeded` in `supabase/functions/stripe-webhook/index.ts` gains a `non_member_profiles` lookup by `stripe_customer_id` mirroring the existing members branch.
- New admin action in `stripe-payment` to sync card metadata for a target `userId` (the current `sync_nonmember_card_metadata` only works for the caller's own account).
- `admin_send_nonmember_card_setup_link` success URL changes to a public confirmation route.
- `BookPTSessionDialog.tsx` search query adds `non_member_profiles`; `NonMemberDetail.tsx` / `NonMemberDetailSheet.tsx` get the booking + sell-pack entry points.
- Separate note: `book_pt_appointment` still compares pass expiry using `America/Chicago`; will switch it to `America/Detroit` to match the rest of the system.
