## Mother's Day Class Pack — Implementation Plan

A limited-time 10-class pack sold on `/class-passes`. **Member $150 / Non-member $265**. Sale ends **Sunday May 11, 2026 at 11:59 PM CT** (hard cutoff May 12 00:00 America/Chicago). Pass valid **2 months** from purchase. Buyable for self **or as a gift**.

---

### 1. Stripe products & prices

Create two one-time prices and add IDs to `STRIPE_PRODUCTS.classPasses.mothersDayPack` in `supabase/functions/stripe-payment/index.ts`:
- `mothers_day_pack_member` — $150
- `mothers_day_pack_nonmember` — $265

### 2. Database

Migration extending `class_passes` with optional gift metadata:
- `gift_buyer_user_id`, `gift_buyer_name`, `gift_buyer_email`
- `gift_recipient_name`, `gift_recipient_email`
- `promo_code` (e.g. `mothers_day_2026`)
- `gift_verification_status` (`auto` | `pending` | `verified` | `rejected`)

No new tables — passes flow through `class_passes` so booking, scanner, portal, expirations all "just work".

### 3. Checkout — embedded, never leaves the site

New action `create_mothers_day_pack_checkout` in `stripe-payment/index.ts`. Returns a **PaymentIntent client_secret** (same embedded Stripe Elements pattern already used by `mothers-day-create-intent`), so the entire purchase happens in a dialog on `/class-passes` with no Stripe-hosted redirect.

Body:
```
{ tier: 'member' | 'nonMember',
  isGift: boolean,
  recipientFirstName?, recipientLastName?, recipientEmail?,
  ... }
```

Server logic:
- Reject if `now() >= 2026-05-12 00:00 America/Chicago` → friendly `success: false` (per the existing decline pattern).
- Server determines correct price tier itself — never trusts the client `tier`:
  - **Self purchase**: looks up the authed user in `members`. Active member → $150. Otherwise → $265.
  - **Gift purchase**: looks up the recipient by **case-insensitive exact email match** (`ilike` on full address) in `members`. Active member found → $150 with `gift_verification_status='auto'`. No active member → $265.
  - The endpoint **never returns or echoes member data** — the only response is the resolved tier, price, and a generic boolean like `{ recipient_is_member: true }`. No name, no list, no fuzzy search, no autocomplete. This prevents the gift form from being abused as a member directory.
- Gross-up processing fee via existing helper.
- PaymentIntent metadata mirrors current class_pass flow plus `promo: 'mothers_day_2026'`, `is_gift`, recipient fields, `validity_days: '60'`.

### 4. Webhook fulfillment

Extend `metadata.type === 'class_pass'` branch in `supabase/functions/stripe-webhook/index.ts`:
- When `metadata.promo === 'mothers_day_2026'`: force `category='pilates_cycling'`, `classes_total=10`, `validityDays=60`.
- For gifts: case-insensitive lookup of `auth.users` by `recipient_email`. If found → assign pass `user_id`/`member_id` to recipient. If not found → create the pass tied to the buyer, stamp `gift_recipient_email`; an existing trigger (or a new one we'll add) will reassign on signup.
- Persist gift columns + `promo_code`.
- Trigger `send-mothers-day-pack-confirmation`.

### 5. New edge function — `send-mothers-day-pack-confirmation`

Two templated emails (warm tan/gold like the flyer):
- **Buyer receipt** — total, gift recipient if any, expiration date.
- **Recipient gift email** — "{Buyer} gifted you a 10-class pack", expiration, `/schedule` link (or `/auth?redirect=/schedule` if no account).

### 6. Frontend — `/class-passes`

New section above the existing pricing grid (auto-hides after May 11 11:59 PM CT):

- **Mother's Day Special — Class Pack** banner using the flyer's tan/brown palette inside the existing Layout.
- Two cards: **Member 10-Pack $150**, **Non-Member 10-Pack $265**.
- Each card shows two CTAs: **Buy for myself** and **Buy as a gift**.
- "Buy as a gift" opens a small dialog asking only: recipient first name, last name, email. No suggestions, no autocomplete.
- Submitting opens an **embedded Stripe Elements payment dialog** (PaymentElement) — no redirect.
- Disclosure text: "Member pricing is automatically applied if the recipient has an active Storm Wellness Club membership."
- Sale rules surfaced: "Valid 2 months from purchase · Special ends Sunday, May 11."
- Reuses existing `liability_waiver` + `class_package` waiver gating.

### 7. Admin verification surface

Small list under Admin → Membership Management:
- "Mother's Day gift passes — pending verification" (filter on `class_passes WHERE promo_code='mothers_day_2026' AND gift_verification_status='pending'`).
- One-click **Confirm member** / **Charge $115 difference** (via existing manual charge cart against the buyer's saved card).

Most gifts will land as `auto` (server already verified) — `pending` is the rare fallback for race conditions.

### 8. Cutoff defense in depth

- Frontend hides the section after the cutoff.
- Edge function rejects after the cutoff.
- Stripe products stay active but unreachable.

---

### Files to create
- `supabase/functions/send-mothers-day-pack-confirmation/index.ts`
- `src/components/marketing/MothersDayClassPackSection.tsx`
- `src/components/marketing/MothersDayPackCheckoutDialog.tsx` (embedded Stripe Elements)
- `src/components/marketing/MothersDayPackGiftFields.tsx`
- `src/components/admin/membership/MothersDayPackVerification.tsx`

### Files to edit
- `supabase/functions/stripe-payment/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/pages/ClassPasses.tsx`
- One DB migration adding gift columns to `class_passes`

### Privacy & security guarantees
- Recipient lookup is **case-insensitive exact email match only**. No partial / fuzzy / autocomplete.
- Endpoint returns only a boolean `recipient_is_member` plus the resolved price — no names, emails, or member identifiers.
- Buyers cannot enumerate the member roster through this flow.
- All time comparisons in `America/Chicago`.
