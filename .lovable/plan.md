
## Goal

When staff charges a member from Cafe POS or from a member's profile, the sale should:
1. Show up in **that member's** purchase history (not the staff user's).
2. Email the member an itemized **receipt** with the charge details.
3. Optionally include a **staff note** (e.g. "Charged 7/18 for açaí bowl purchased 7/16") that appears in the receipt and on the internal record.

---

## Changes

### 1. Attribute cafe POS orders to the actual buyer
- `src/hooks/useCafeOrder.ts` — extend `CreateOrderParams` with optional `memberId`, `userId`, `staffNote`, and `chargedByLabel`. When provided (POS flow), insert `cafe_orders` with those values instead of the current staff `auth.uid()` lookup. Fallback behavior for the member self-order path stays unchanged.
- `src/pages/admin/FrontDeskPOS.tsx` — pass `selectedCustomer.memberId` / `userId` and the new note into `createOrder.mutateAsync`. Also pass them into the `stripe-payment` invocation (`memberId` is already accepted; add `note`).

### 2. Add a "Note for receipt" field (staff-facing, member-visible)
- `src/pages/admin/FrontDeskPOS.tsx` — add a `Textarea` above the "Charge Card / Cash / Clover" actions, labelled "Note (shown on receipt — optional)". Placeholder: "e.g. Charged today for açaí bowl purchased on 7/16".
- `src/components/admin/MemberDetailSheet.tsx` — same note field inside the existing "Charge card on file" dialog (member profile → Process).
- DB migration: add `note TEXT` column to `manual_charges` and `cafe_orders`. Include GRANTs consistent with existing columns.
- `supabase/functions/stripe-payment/index.ts` (`charge_saved_card` + `charge_saved_card_with_3ds` branches): accept `body.note`, store on the `manual_charges` insert, and include in the Stripe PaymentIntent `metadata.note` and `description` suffix for Stripe dashboard visibility.

### 3. Email receipt on successful charge
- New template case in `supabase/functions/send-email/index.ts`: `pos_charge_receipt`. Inputs: `customerName`, `email`, `lineItems[]` (name, qty, unitPrice), `subtotal`, `tax`, `processingFee`, `total`, `cardBrand`, `cardLast4`, `chargedAt`, `staffNote?`. Uses existing minimal receipt footer style. Subject: `Your receipt from Storm Wellness Club — $X.XX`.
- `supabase/functions/stripe-payment/index.ts`: after `manual_charges` insert succeeds and PI is `succeeded`, look up the member's email + name and invoke `send-email` with `pos_charge_receipt`. Payload includes the parsed line items (POS passes them; member-profile charge sends single line = description).
- POS passes structured `lineItems` in the `stripe-payment` body so the receipt itemizes them (not just "Front Desk POS — item1, item2").
- Guard with try/catch; receipt failure never blocks the charge (log warning only).

### 4. Purchase history visibility
- `src/components/admin/MemberDetailSheet.tsx` — the existing "Purchase History" section already reads `manual_charges` + `cafe_orders` filtered by the member's IDs. With change #1, POS cafe orders will now appear there automatically. Verify the tab surfaces the new `note` (small muted line under the row).

---

## Out of scope
- No change to member self-service cafe orders (already correctly attributed).
- No change to Stripe-hosted receipts (we send our own branded receipt).
- No change to Clover/Cash flows beyond recording the note; those don't email a card receipt but the `cafe_orders.note` is stored and shown in history.

---

## Technical notes
- Migration adds two nullable `note TEXT` columns — no data backfill needed.
- The receipt uses the member's `profiles.email` (falls back to `members.email`); if neither present, skip send and log.
- Idempotency: receipt send is gated on `paymentIntent.status === 'succeeded'` and only after the `manual_charges` row is inserted, so the retry path in Stripe won't double-send from this code path.
