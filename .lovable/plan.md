# Let staff type in a non-member's card

## What you'll get
On a non-member's profile (Admin → Non-Member Accounts → open the person), the **Card on File** box gets a new **Enter card** button next to "Email setup link" and "Copy link".

- Press it and a secure card form opens right in the box (card number, expiry, CVC, ZIP).
- Type in the card the client sends you and press **Save card**.
- Nothing is charged. It only saves the card on file.
- The box then shows the new card (brand, last 4, expiry), and it works for PT sales, register charges and anything else that uses their card on file.
- If the card is declined, you'll see the bank's reason and nothing is saved.
- Only managers and admins see the button. Front desk keeps the "Email setup link" and "Copy link" buttons.

The same button goes on the Front Desk non-member page for managers and admins.

## A note on safety
Card details go straight to Stripe and are never stored by the club's system. When a client sends a card number by text or email, it stays in that message. It's best to delete the message once the card is saved.

## Technical details
- New `stripe-payment` action `admin_create_nonmember_setup_intent`: manager/admin/super_admin only. It finds or creates the Stripe customer from `non_member_profiles` the same way `admin_send_nonmember_card_setup_link` does, saves `stripe_customer_id`, and returns a SetupIntent client secret with `usage: off_session` and metadata `{ user_id, source: 'admin_nonmember_card_entry', added_by }`.
- `AdminAddCardForm` gets an optional `nonMemberUserId` prop. On success it calls the existing `sync_nonmember_card_metadata` action and sets the new card as the customer's default payment method, so saved-card charges pick it.
- `NonMemberDetail.tsx` (admin) and front-desk `NonMemberDetail.tsx` show the inline Stripe `Elements` form with a `stripeRemountKey` for a fresh mount each time, then refresh the profile.
- Failures are logged through `log_card_setup_failure`.
- Add a short rule to `supabase/functions/AGENTS.md`.
