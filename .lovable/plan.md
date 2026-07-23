## 1. Confirming Mariam's guest pass credits

Yes — the previous fix already converted her 10 "guest pass credits" into class credits on her `member_credits` record. She has no lingering guest-pass-credit rows.

To prevent a repeat, the root cause is the grant dialog itself:
- The dialog defaults members to **"Guest Pass Credit"** (which lets a member bring guests), but the label is easy to misread as "credits for the member".
- There is no direct **"Class Credits"** option in the grant dialog today — the only way to give free classes is via the "Class Pass" (single / 10-pack) option, which some admins skip past.

## 2. Fix the "Grant Pass / Credit" dialog UI

Problem: `sm:max-w-md` with no scroll → on smaller windows the inputs get clipped and the number field is tiny.

Changes in `src/components/admin/AdminGrantPassDialog.tsx`:
- Widen dialog to `sm:max-w-lg`, add `max-h-[85vh] overflow-y-auto` so the body scrolls when needed.
- Enlarge the quantity `<Input type="number">` (h-11, text-lg, `inputMode="numeric"`) and add quick-pick chips (1 / 5 / 10) for wellness / guest pass credit fields.
- Reorder member-grant options so **Class Credits** appears first (see below), rename `guest_pass_credit` label to **"Guest Pass Credit — lets member invite guests"** to remove ambiguity.
- Add a new grant type **`class_credits`** that writes to `member_credits` with `credit_type = 'class'` (matches what `useBooking` looks for). Uses the same "add to existing active cycle" logic as wellness credits.

## 3. Sell a gift card from a member account (with custom email)

New end-to-end feature.

### Data model — new migration
- Table `public.gift_cards`
  - `code` (unique, human-friendly like `STORM-XXXX-XXXX`)
  - `amount_cents`, `balance_cents`
  - `purchaser_member_id`, `purchaser_user_id` (nullable)
  - `recipient_name`, `recipient_email`, `custom_message`
  - `payment_method` ('card_on_file' | 'cash' | 'clover' | 'external')
  - `status` ('active' | 'redeemed' | 'void'), `issued_by`, `notes`, `expires_at`
- Table `public.gift_card_redemptions` — audit trail of applications against `cafe_orders` / `manual_charges` / spa etc.
- RLS: admins/front_desk full access; members can read their own purchased cards and any card whose email matches theirs (to see balance). Standard `GRANT` block.

### Admin UI — new dialog `SellGiftCardDialog.tsx`
Opened from a "Sell Gift Card" button on `MemberDetail.tsx` (charge/actions area) and from Front Desk POS.
Fields:
- Amount (preset chips $25 / $50 / $100 / $150 / custom)
- Recipient name + email (defaults to the member if it's for themselves; toggle "This is a gift for someone else")
- Custom message (textarea)
- Payment method: **Card on file** (member's saved Stripe card), Cash, Clover, External (mirrors the guest-pass POS pattern)
- Optional expiration date

On submit:
1. If `card_on_file`: call existing `charge-member-card` edge function with amount + `chargeType: 'gift_card'` and a note `Gift card for <recipient>`.
2. Insert into `gift_cards` (generating unique code) — done in a new edge function `create-gift-card` so the code and Stripe charge stay atomic.
3. Trigger the app-email `gift-card-delivery` (below) to the recipient with the code + custom message. Purchaser gets a receipt (existing `pos_charge_receipt` covers the charge itself).

### Email template
- Add `supabase/functions/_shared/transactional-email-templates/gift-card-delivery.tsx` — brand-styled: recipient name, sender name, custom message block, gift code, amount, expiration, "How to redeem" copy, link to `stormwellnessclub.com`.
- Register in `registry.ts`. Deploy `send-transactional-email`.

### Redemption (initial scope)
- Show gift card balance in the member portal under Passes.
- Admin can look up a card by code from POS / MemberDetail and apply balance to a `manual_charges` cart line (creates a row in `gift_card_redemptions`, decrements `balance_cents`).
- Full auto-application at every checkout surface is out of scope for this pass — flagged as follow-up.

## Technical notes
- No Stripe product needed; gift card is a member charge captured to the member's existing customer.
- Gift card code generator: 12 chars, uppercase alphanumeric excluding I/O/0/1, unique-checked in a `SECURITY DEFINER` RPC.
- Email includes unsubscribe footer automatically via infra.

## Files touched
- `src/components/admin/AdminGrantPassDialog.tsx` — resize + new "Class Credits" type + relabel.
- `supabase/migrations/*` — new gift card tables + RPC.
- `src/components/admin/SellGiftCardDialog.tsx` — new.
- `src/pages/admin/MemberDetail.tsx` — wire "Sell Gift Card" button.
- `src/pages/frontdesk/POS.tsx` — same button.
- `supabase/functions/create-gift-card/index.ts` — new edge function.
- `supabase/functions/_shared/transactional-email-templates/gift-card-delivery.tsx` + registry — new template.
- `src/pages/portal/Passes.tsx` — show gift card balance.

## Out of scope (flag for later)
- Automatic gift-card application at cafe/spa/class-pass checkout.
- Public gift-card purchase page for non-members.
- Partial refund of a gift card back to the purchaser.
