## Remove Apple/Google Wallet integration

Strip the wallet save feature entirely — no secrets needed, simpler UX.

### Changes

1. **Delete files**
   - `src/components/mothers-day/WalletButtons.tsx`
   - `supabase/functions/mothers-day-wallet-apple/index.ts`
   - `supabase/functions/mothers-day-wallet-google/index.ts`
   - Call `supabase--delete_edge_functions` for `mothers-day-wallet-apple` and `mothers-day-wallet-google`.

2. **`src/pages/MothersDayRedeem.tsx`** — remove `WalletButtons` import and usage. Keep the "Linked to your account" badge and existing voucher details (code, expiration, non-transferable notice stay visible on-page).

3. **`supabase/functions/send-mothers-day-voucher/index.ts`** — remove any wallet button links from the gift email HTML if added. Keep the "★ Save this code" callout, expiration date, and non-transferable wording in the email body so recipients can screenshot/save manually.

### What stays
- Voucher auto-linking to account on signup (DB trigger)
- Account-first claim flow (`/auth?mode=signup&voucher=...`)
- Admin email preview dialog
- Expiration date + non-transferable notice (shown in email + redeem page)
