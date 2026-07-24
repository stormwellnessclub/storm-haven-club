# Add card on file for non-members

## Current state
- Non-members can already add/update a card themselves at **/portal/payment-methods** using an in-app Stripe PaymentElement (`create_nonmember_setup_intent` + `sync_nonmember_card_metadata`).
- Admin **cannot** initiate a card add for a non-member from `src/pages/admin/NonMemberDetail.tsx` — only "Refresh card from Stripe" exists today.

## What to build

### 1. Admin-initiated "Send card setup link" (email flow)
New button on `NonMemberDetail.tsx` in the payment section (next to "Refresh card"). Clicking it:
- Calls new edge action `admin_send_nonmember_card_setup_link` on `stripe-payment`.
- Server creates a Stripe **Checkout Session in `mode: 'setup'`** for that non-member's Stripe customer (create customer if missing), with `success_url` = `/portal/payment-methods?card_added=1` and `cancel_url` = `/portal/payment-methods`.
- Server invokes `send-transactional-email` with new template `nonmember-card-setup-link` (recipient = non-member email, contains the hosted Stripe URL, expires in 24h note).
- Success toast shows "Setup link sent to {email}".

### 2. Card-added confirmation on return
On `/portal/payment-methods`, when `?card_added=1` is present:
- Call `sync_nonmember_card_metadata` (already exists) to pull the new PM into `non_member_profiles`.
- Show success toast, strip the query param.

### 3. Webhook safety net
In `supabase/functions/stripe-webhook/index.ts`, on `checkout.session.completed` where `mode === 'setup'` and metadata `purpose === 'nonmember_card_on_file'`:
- Set the resulting payment method as customer default.
- Update `non_member_profiles.card_brand/last4/exp_*` from the PaymentMethod.
- This covers the case where the non-member closes the tab before hitting the return URL.

### 4. Admin: "Copy setup link" alternative
Same action returns the URL to the admin UI, so admin can copy/paste it into a text/Clover receipt instead of email if desired.

### 5. Self-serve visibility (small tweak)
On the non-member portal Dashboard, if `!card_last4`, add a small "Add a card on file" call-to-action linking to `/portal/payment-methods`. Users already have access — this just makes it obvious.

## Files to touch

- `supabase/functions/stripe-payment/index.ts` — add `admin_send_nonmember_card_setup_link` (admin-role guarded, resolves customer, creates setup Checkout Session with `metadata.purpose='nonmember_card_on_file'`, sends email, returns `{ url }`).
- `supabase/functions/_shared/transactional-email-templates/nonmember-card-setup-link.tsx` — new React Email template with CTA button to the Stripe URL. Register in `registry.ts`.
- `supabase/functions/stripe-webhook/index.ts` — handle `mode==='setup'` completion for non-members (default PM + sync metadata).
- `src/pages/admin/NonMemberDetail.tsx` — add "Send card setup link" and "Copy link" buttons in the payment card block.
- `src/pages/portal/PaymentMethods.tsx` — detect `?card_added=1`, call sync, toast, clean URL.
- `src/pages/portal/Dashboard.tsx` — conditional "Add card on file" CTA when none exists.

## Out of scope (per your reply)
- Admin entering raw card numbers in-app. PCI + Stripe Link/Radar restrictions make this the wrong path; the emailed/hosted link keeps you PCI-safe and Stripe handles 3DS.

## Notes
- No schema changes needed — reusing existing `non_member_profiles` card columns.
- No new secrets.
- Uses existing Lovable transactional email infra.
