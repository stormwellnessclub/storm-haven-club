
# Mother's Day Special — Massage + Wet Spa Access

The product is an **add-on package**: customer picks any massage from the menu (60 or 90 min), and the Mother's Day Special grants them **Exclusive Wet Spa Access** that day — Sauna, Steam Room, and Himalayan Salt Room — plus a 6-month redemption window. Sold as self-use or gift, with a TO/FROM card design matching the uploaded artwork.

## 1. Data model — `mothers_day_vouchers` table

```text
id              uuid pk
code            text unique         -- e.g. MOM-7K2X9P (shown on voucher)
buyer_user_id   uuid (nullable, links auth.users)
buyer_name      text
buyer_email     text
recipient_name  text (nullable — blank = self)
recipient_email text (nullable)
gift_message    text (nullable)
massage_choice  text (nullable)     -- pre-selected at checkout, or "TBD"
massage_duration int                -- 60 or 90
amount_paid_cents int
stripe_payment_intent_id text
status          text                -- 'active' | 'redeemed' | 'expired' | 'refunded'
purchased_at    timestamptz default now()
expires_at      timestamptz         -- purchased_at + 6 months
redeemed_at     timestamptz (nullable)
redeemed_appointment_id uuid (nullable, FK spa_appointments)
created_at      timestamptz default now()
```

RLS: buyers can read their own vouchers; admins/staff can read/update all; redemption is via SECURITY DEFINER RPC.

## 2. Stripe products

Two prices (one per duration), each named "Mother's Day Special — Custom Massage + Wet Spa Access":
- 60 min — price set per current menu pricing for a 60-min custom massage (e.g. matches existing custom massage line)
- 90 min — same for 90-min

We'll list current massage prices from `spa_services` (Massage category) and confirm the two amounts before creating Stripe products. Both products tagged with metadata `{ campaign: "mothers_day_2026" }` so the Stripe webhook handler / payment-link fulfillment can route to the voucher table.

## 3. Public landing — `/mothers-day`

A dedicated marketing page styled to match the uploaded card (cream background, gold serif headings, signature "Happy Mother's Day" script):

- Hero with the Aella mark + "Mother's Day Special"
- Bullet list: Custom Massage + Sauna · Steam · Himalayan Salt Room
- "Redeemable for 6 months" pill
- Two CTA tiles: **60 min** / **90 min**, each opening a checkout sheet
- Checkout sheet collects: buyer name/email (auto-filled if logged in), optional recipient name/email + gift message, then redirects to Stripe Checkout
- After successful payment: branded confirmation page with the voucher code and a "Print/Email Card" action

Linked from the homepage (small seasonal banner) and the Spa page.

## 4. Spa page — new "Mother's Day" category tab

Add `"Mother's Day"` to the `categories` array on `src/pages/Spa.tsx` (placed first so it stands out). Inside, render a single hero card matching the uploaded design with:
- Aella logo, "Mother's Day Special" heading, the bullet points, "Happy Mother's Day" signature
- "Buy Gift Voucher" primary CTA → routes to `/mothers-day`

This avoids cluttering the Massage tab while still being discoverable from the spa menu.

## 5. Member portal banner

Add a dismissible top banner to `src/pages/portal/Dashboard.tsx` and `src/pages/member/Dashboard.tsx`:
- Cream/gold styling, signature script accent
- Copy: "Mother's Day Special — Custom Massage + Exclusive Wet Spa Access. Give the gift of renewal."
- CTA: "View Special" → `/mothers-day`
- Auto-hides after Mother's Day (May 10, 2026) or once the user dismisses it (stored in `localStorage`)

## 6. Redemption flow (how staff "knows" they bought it)

Two paths:

**A. Voucher code at booking time (primary):**
- On the spa booking modal, add a "Have a voucher?" field. Entering a `MOM-…` code:
  - Validates against `mothers_day_vouchers` (active, not expired)
  - Pre-selects the massage and shows a gold "Mother's Day Special — includes Wet Spa Access" badge on the appointment
  - Marks voucher as `redeemed` and links `redeemed_appointment_id` on confirm
- Skips payment (already paid)

**B. Front desk lookup (fallback for in-person):**
- New admin tab **Spa Management → Mother's Day** lists all vouchers with filters (active / redeemed / expired), search by code/name/email
- "Redeem" button to mark a voucher used and attach to an appointment if booked offline

**Visibility on the appointment:** Any spa appointment created from a Mother's Day voucher carries `notes: "MOTHER'S DAY SPECIAL — Wet Spa Access included (Sauna · Steam · Himalayan Salt Room)"` and a gold badge in the admin Appointments view, the Therapist schedule, and the kiosk. This is the cue staff use to grant wet spa access on the day of service.

## 7. Email confirmation / gift delivery

`send-mothers-day-voucher` edge function, triggered after Stripe webhook marks payment succeeded:
- If `recipient_email` provided → send the branded card (TO/FROM, signature, voucher code, redemption instructions, expiration date) to recipient, with a CC-style copy to buyer
- If recipient blank → send the voucher to the buyer
- HTML email mirrors the uploaded card styling (cream/gold, serif + signature)

## 8. Admin — Mother's Day dashboard

New tab inside Spa Management:
- KPI cards: Sold (count + revenue), Redeemed, Outstanding, Expiring soon
- Sales list with buyer/recipient, amount, status, code, redemption date
- Export CSV
- Goal tracker: "X of 50 sold" progress bar (since the user's stated goal is 50)

## Technical details

- New table + RLS migration as described in §1
- `mothers_day-checkout` edge function (creates Stripe Checkout session in `payment` mode, stores pending voucher row with status `pending` keyed by `payment_intent_id`)
- `mothers_day-webhook` (or extension to existing Stripe webhook) flips status to `active`, generates code, sends email
- `redeem_mothers_day_voucher(p_code text, p_appointment_id uuid)` SECURITY DEFINER RPC — atomic update with status check
- Banner component: `<MothersDayBanner />` reused across portal/member dashboards
- New route: `<Route path="/mothers-day" element={<MothersDay />} />` in `src/App.tsx`
- Update memory with a `features/promotions/mothers-day-special` note covering voucher schema, redemption RPC, and 6-month expiry rule

## Files to create / change

Create:
- `supabase/migrations/…_mothers_day_vouchers.sql`
- `supabase/functions/mothers-day-checkout/index.ts`
- `supabase/functions/send-mothers-day-voucher/index.ts`
- `src/pages/MothersDay.tsx` (public landing + checkout sheet + success view)
- `src/components/marketing/MothersDayBanner.tsx`
- `src/components/admin/spa/MothersDayTab.tsx`
- `mem://features/promotions/mothers-day-special.md`

Edit:
- `src/App.tsx` — add `/mothers-day` route
- `src/pages/Spa.tsx` — add "Mother's Day" category + featured card
- `src/pages/portal/Dashboard.tsx`, `src/pages/member/Dashboard.tsx`, `src/pages/Index.tsx` — add banner
- `src/pages/admin/SpaManagement.tsx` — add "Mother's Day" tab
- `src/components/booking/SpaBookingModal.tsx` — voucher code field + apply logic
- Stripe webhook handler — route campaign metadata to voucher fulfillment
- `mem://index.md` — add reference

## Open question before I build

What should the **two prices** be? I can either:
1. Match the existing Custom Massage 60 / 90 min prices from your spa menu exactly (no change), or
2. Set a special bundle price (e.g. $20 over the standalone massage to reflect the wet spa access value)

I'll default to option 1 (current massage prices, wet spa access included free as the holiday perk) unless you say otherwise.
