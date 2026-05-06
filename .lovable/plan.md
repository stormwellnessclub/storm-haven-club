## Goal
1. Auto-link every Mother's Day voucher to the redeemer's account (buyer for self, recipient for gifts).
2. Guide gift recipients to create an account so the voucher links to them; remind them to save the code.
3. Add an admin **Preview email** button.
4. **NEW:** Let recipients **save the voucher to Apple / Google Wallet**, with expiration date and a clear **"Non-transferable"** notice on the pass.

Codes are already unique (`generate_mothers_day_code()` + UNIQUE).

## Plan

### 1. Auto-link voucher to account (DB)
- Migration: add `recipient_user_id uuid` column on `mothers_day_vouchers`.
- New trigger on `auth.users` (AFTER INSERT / AFTER UPDATE of email):
  - Set `buyer_user_id` on any voucher where `lower(buyer_email)=lower(NEW.email)` and `buyer_user_id IS NULL`.
  - Set `recipient_user_id` where `lower(recipient_email)=lower(NEW.email)` and `recipient_user_id IS NULL`.
- One-time backfill against existing users.

### 2. Gift recipient onboarding
- Update `send-mothers-day-voucher` → `buildGiftHtml`:
  - Add a one-line "★ Save this code — you'll need it at check-in" callout above the code box.
  - Primary CTA → `/auth?mode=signup&voucher=<code>&redirect=/mothers-day/redeem?code=<code>`.
  - Secondary text link "Already have an account? Sign in" → `/auth?mode=signin&redirect=/mothers-day/redeem?code=<code>`.
- `src/pages/Auth.tsx`: read `?voucher=` and after signup/signin redirect to `/mothers-day/redeem?code=<voucher>` (DB trigger handles linking).
- `src/pages/MothersDayRedeem.tsx`: show "Linked to your account ✓" badge when `recipient_user_id = auth.uid()` (or buyer match).

### 3. Admin "Preview email" button
- In `MothersDayTab.tsx` add an 👁 Preview button per voucher.
- Opens a Dialog with tabs (Gift email if recipient set, Buyer receipt always).
- Calls `send-mothers-day-voucher` with `{ voucher_id, preview: true }`; function short-circuits and returns `{ recipient_html, recipient_subject, buyer_html, buyer_subject }` without sending or logging.
- Each tab renders the HTML in an `<iframe srcDoc={html}>` with the subject above it. Single source of truth — no duplicate templates.

### 4. Save voucher to Wallet (Apple + Google)
Add a **"Save to Wallet"** section on `/mothers-day/redeem` (visible whenever a valid voucher is loaded) and inside the gift email (secondary CTA buttons).

**Pass content (both Apple & Google):**
- Title: "Mother's Day Special — Storm Wellness Club"
- Recipient name (or buyer name for self-purchases)
- Massage choice + duration (e.g. "Custom Massage · 60 min + Wet Spa Access")
- **Code** (also encoded as a QR/PDF417 barcode for front-desk scan)
- **Expiration date** (`expires_at`, formatted as "Expires Nov 6, 2026")
- Footer / fine print: **"Non-transferable. Valid only for the named recipient. One-time use."**
- Brand colors: gold `#a17e3a` background, cream foreground.

**Apple Wallet (.pkpass):**
- New edge function `mothers-day-wallet-apple` that:
  - Loads voucher by code (or signed token).
  - Builds `pass.json` (storeCard style) with the fields above and a `barcode` of the code.
  - Signs and zips into a `.pkpass` using Apple WWDR + Pass Type ID cert.
  - Returns `application/vnd.apple.pkpass`.
- Requires three secrets (will request via secret tool before building this part):
  - `APPLE_PASS_TYPE_ID` (e.g. `pass.com.stormwellnessclub.mothersday`)
  - `APPLE_TEAM_ID`
  - `APPLE_PASS_CERT_P12_BASE64` + `APPLE_PASS_CERT_PASSWORD`
- If certs aren't provided yet, the button shows a graceful "Apple Wallet pass coming soon — your code is also saved in your account" tooltip; we wire the function up so it works the moment secrets land.

**Google Wallet:**
- New edge function `mothers-day-wallet-google` that:
  - Builds a Google Wallet **Generic / Offer** class+object JWT with the same fields and barcode.
  - Signs with a service account.
  - Returns `{ saveUrl: "https://pay.google.com/gp/v/save/<jwt>" }`.
- Requires secrets:
  - `GOOGLE_WALLET_ISSUER_ID`
  - `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` (full JSON, base64)
- Same graceful fallback if missing.

**Frontend:**
- Component `WalletButtons` (new, used on `MothersDayRedeem.tsx`) renders:
  - "Add to Apple Wallet" button (only on iOS / Safari by default, but always shown to logged-in recipients) → downloads the `.pkpass`.
  - "Save to Google Wallet" button → opens the returned `saveUrl`.
- Add the same two buttons inside the gift email as plain `<a>` deep links to `/mothers-day/redeem?code=<code>` (the wallet buttons render on that page once they arrive).

**Wallet-pass copy (locked):**
- Front: "Mother's Day Special · {Massage} · {Duration} min · + Wet Spa Access"
- Back / details: "Non-transferable. Valid only for {Recipient Name}. One-time use. Expires {Date}. Present this pass or your code at check-in."

## Files to touch
- **Migration**: `recipient_user_id` column + linking trigger + backfill.
- **Edge functions**:
  - `send-mothers-day-voucher/index.ts` — preview mode + updated gift HTML (save-code line, auth-first CTA, wallet links).
  - `mothers-day-wallet-apple/index.ts` *(new)*.
  - `mothers-day-wallet-google/index.ts` *(new)*.
- **Frontend**:
  - `src/components/admin/spa/MothersDayTab.tsx` — Preview dialog.
  - `src/pages/Auth.tsx` — `?voucher=` redirect.
  - `src/pages/MothersDayRedeem.tsx` — "Linked ✓" badge + `WalletButtons`.
  - `src/components/mothers-day/WalletButtons.tsx` *(new)*.

## Open questions (will default if not answered)
1. **Apple Wallet certs** — do you already have an Apple Developer Pass Type ID + signing cert? If not, I'll build the function and stub the button until you upload `APPLE_PASS_CERT_P12_BASE64` / `APPLE_PASS_CERT_PASSWORD` / `APPLE_PASS_TYPE_ID` / `APPLE_TEAM_ID`.
2. **Google Wallet** — do you have a Google Pay & Wallet Console issuer account? If not, same approach: stub button until `GOOGLE_WALLET_ISSUER_ID` + `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` are added.
3. **Pass type** — Apple `storeCard` (default, looks like a gift card with barcode) vs `coupon`. Defaulting to `storeCard`.
