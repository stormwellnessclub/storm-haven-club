## Mother's Day Special — In-App Checkout + Buyer Data Capture

Right now the Mother's Day flow redirects to Stripe Checkout and only captures name + email. You want the whole purchase to happen inside the app, and you want to know who's buying — especially non-members — including their gender and whether the voucher is for someone else. No SMS opt-in.

### 1. Switch to embedded Stripe checkout (no redirect)

Replace Stripe Checkout (hosted page) with an in-app `PaymentElement` flow, the same pattern used everywhere else in the app (`PaymentSectionEnhanced`, `MembershipActivationPayment`, `AdminChargeWith3DS`).

Flow:
1. User fills buyer + (optional) recipient details on `/mothers-day`.
2. Click "Pay $X" → calls new `mothers-day-create-intent` edge function.
3. Edge function inserts a `pending` voucher row, then creates a Stripe **PaymentIntent** with `amount`, `metadata.voucher_id`, `metadata.campaign = "mothers_day_2026"`, returns `client_secret`.
4. Frontend mounts `<StripeProvider clientSecret>` with `PaymentElement`, user enters card inline, calls `stripe.confirmPayment({ redirect: "if_required" })`.
5. On success, frontend calls `mothers-day-confirm` (existing) which marks voucher `active`, generates `MOM-XXXXXX` code, fires `send-mothers-day-voucher`.
6. User stays on `/mothers-day`, shows the same gold confirmation card with voucher code, copy button, "Book Massage" CTA.

No URL redirect. `success_url`/`cancel_url` removed.

### 2. Expanded buyer data capture (required fields)

The form will collect on every purchase:
- **Buyer first name** *(required)*
- **Buyer last name** *(required)*
- **Buyer email** *(required)*
- **Buyer phone** *(required)* — used for redemption lookup
- **Buyer gender** *(required)* — radio: Female / Male / Prefer not to say
- **Is this a gift?** checkbox

If gift = yes:
- **Recipient first name** *(required)*
- **Recipient last name** *(required)*
- **Recipient email** *(required)*
- **Recipient phone** *(optional)*
- **Recipient gender** *(required)* — Female / Male / Prefer not to say
- **Personal message** *(optional)*

For logged-in members, buyer fields prefill from their profile but stay editable. No SMS / marketing opt-in checkbox anywhere — explicitly excluded per your direction.

### 3. Schema additions

Migration adds columns to `mothers_day_vouchers`:
- `buyer_first_name`, `buyer_last_name`, `buyer_phone`, `buyer_gender` (text)
- `recipient_first_name`, `recipient_last_name`, `recipient_phone`, `recipient_gender` (text)
- `stripe_payment_intent_id` (text) — replaces session-id-only tracking
- Keep existing `buyer_name` / `recipient_name` populated as `first + " " + last` for backwards compatibility with the email + admin tab.

Existing rows untouched (all new columns nullable).

### 4. Non-member tracking

When a non-member (no `buyer_user_id`) buys, the voucher row itself **is** the non-member record — name, email, phone, gender all stored. The Mother's Day admin tab already lists every voucher; we'll extend its detail view + CSV export to include the new fields, and add a "Member / Non-member" column so you can see at a glance who's new to the club. Easy follow-up audience for the lead list.

### 5. Files

**New**
- `supabase/migrations/...` — add columns above
- `supabase/functions/mothers-day-create-intent/index.ts` — PaymentIntent + pending voucher insert

**Edit**
- `src/pages/MothersDay.tsx` — new form fields, embedded `<PaymentElement>` step, no redirect
- `supabase/functions/mothers-day-confirm/index.ts` — accept `payment_intent_id` instead of (or alongside) `session_id`
- `src/components/admin/spa/MothersDayTab.tsx` — show phone, gender, member/non-member; include in CSV
- `mem://features/promotions/mothers-day-special.md` — record embedded-checkout + required fields

**Delete (cleanup)**
- `mothers-day-checkout` edge function (or keep as deprecated stub) — replaced by `create-intent`

### Technical notes

- PaymentIntent uses `automatic_payment_methods: { enabled: true }`.
- `confirmPayment({ redirect: "if_required" })` — keeps user on page; only redirects for 3DS, which returns to `/mothers-day` and resumes via `payment_intent` query param.
- `mothers-day-confirm` becomes idempotent on `stripe_payment_intent_id` so 3DS returns and explicit calls don't double-fire emails.
- Validation: zod schema on the edge function rejects missing required fields and invalid gender enum.
- Gender stored as enum-style text: `female | male | prefer_not_to_say`.
