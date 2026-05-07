# Mother's Day Class Pack — Audit Fixes + Copy Updates

I audited the full flow and found 5 logic gaps. I'll also fix the copy you flagged.

## Copy fixes (per your message)

On `/class-passes` Mother's Day section:
- Member card description: "10-Class Pack — for active **Storm Wellness Club members**" (was "Storm members")
- Both "Buy as a gift" buttons → "**Buy as a gift for a Storm Wellness Club member**" on the member card, and "**Buy as a gift**" on the non-member card
- Footnote: "Member pricing is automatically applied if the buyer or gift recipient has an active **Storm Wellness Club** membership — verified at checkout."
- Gift dialog title: "Send a Mother's Day Gift" → keep, but the recipient helper text becomes: "If this email matches an active **Storm Wellness Club member**, you'll get member pricing automatically."

## Logic gaps found & fixes

### 1. Gift recipients without an account get a broken claim path (MAJOR)
Recipient email links to `/auth?redirect=/schedule`. If recipient is not an existing member, the pass is created under the **buyer's** `user_id` — so when the recipient signs up they have no pass.

**Fix:** Allow `class_passes.user_id = NULL` for unclaimed gifts. Match by `LOWER(gift_recipient_email)`. Add a trigger on `auth.users` insert that auto-claims any orphan passes with matching email. Also expose a `claim_mothers_day_pack` RPC for the redeem page.

### 2. No fulfillment if buyer is anonymous and recipient has no account
Currently returns `manual_required` and writes nothing. Stripe takes the money; system has no record.

**Fix:** Always write the `class_passes` row (with NULL user_id when needed) so the purchase is tracked and admin can see it.

### 3. No webhook safety net (MAJOR)
If the user closes the tab between Stripe success and the confirm call, payment succeeds but no pass is ever created and no email sent. `stripe-webhook` doesn't handle these intents.

**Fix:** In `stripe-webhook`'s `payment_intent.succeeded` branch, detect `metadata.type === "mothers_day_class_pack"` and invoke `mothers-day-pack-confirm` server-side. The confirm function is idempotent.

### 4. No admin tracking surface
`MothersDayTab` reads `mothers_day_vouchers` (different system). No admin view exists for these class-pack purchases.

**Fix:** New admin page `/admin/mothers-day-class-packs` with list, filters, summary stats, and per-row actions (mark verified, resend email, manually assign user). Link from sidebar under Membership Management.

### 5. Recipient email CTA lands on bare auth screen
Generic `/auth?redirect=/schedule` with no context.

**Fix:** New public page `/mothers-day-pack-redeem?email=<recipient>` — branded landing showing the gift, who sent it, expiration, and a context-aware CTA (sign up / sign in / view schedule).

### Bonus: tighter idempotency
Confirm function uses a 1-hour window for dedupe. Switch to keying by `stripe_payment_intent_id` stored on the pass row (add column if missing).

---

## Files

**New**
- `src/pages/MothersDayPackRedeem.tsx` (+ route)
- `src/pages/admin/MothersDayClassPacks.tsx` (+ route + sidebar entry)
- `supabase/functions/mothers-day-pack-lookup/index.ts` — public, returns pass summary by email
- DB migration: add `stripe_payment_intent_id` to `class_passes` (if missing) + index, trigger on `auth.users` to auto-claim orphan passes by email, `claim_mothers_day_pack(email)` RPC

**Edited**
- `src/components/marketing/MothersDayClassPackSection.tsx` — copy updates
- `supabase/functions/mothers-day-pack-confirm/index.ts` — allow null user_id, idempotency by PI id
- `supabase/functions/stripe-webhook/index.ts` — call confirm on `payment_intent.succeeded` for type `mothers_day_class_pack`
- `supabase/functions/send-mothers-day-pack-confirmation/index.ts` — recipient CTA → `/mothers-day-pack-redeem?email=...`

After implementation I'll trace each path: signed-in member self-purchase, guest non-member self-purchase, gift to existing member, gift to non-member without account, and tab-close-mid-confirm (webhook fallback).