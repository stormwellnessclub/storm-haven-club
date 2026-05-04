## Cafe Sales: Hitting Targets

### Reality check (live data)
- **108 active members**, **113 menu items across 15 categories** — supply is fine.
- **Last 6 months of cafe orders: 6 completed totaling $0.89** (most are tests). Cafe is essentially zero-revenue today.
- **Only 2 profiles have `sms_opt_in = true`** — SMS won't be a meaningful cafe channel until we drive opt-in. Email + on-property triggers carry the load early.

The constraint isn't "marketing the cafe" yet — it's **awareness, ordering friction, and habit formation**. Plan attacks all three with the existing rails (cafe orders table, email/SMS infra, member portal, kiosks, manual charges).

### Target framing
Realistic Q3 target: **$8k/mo cafe revenue** (≈ 30% of active members ordering 1×/week at avg $7 ticket). Plan instruments this so we see the gap weekly, not at month-end.

---

### What gets built (5 pieces, all in admin Marketing → new "Cafe" subtab)

**1. Cafe Sales Command Center** — `src/components/admin/marketing/CafeSalesTab.tsx`
A single screen with:
- **Target vs actual:** monthly revenue goal (editable, persisted in `app_settings`), MTD revenue, gap-to-target, daily run-rate needed to close.
- **Funnel KPIs:** active members, members who've *ever* ordered, members ordered last 30d, members ordered last 7d, repeat-order rate, avg ticket, top 5 items, top 5 lapsed buyers.
- **Channel rollups:** orders by source (member portal vs admin POS vs kiosk) — surfaces which entry points actually convert.

**2. Three Cafe Playbooks** added to `CampaignPlaybooks.tsx` as a third audience type `"cafe"`:
- **First Sip** — active members who have NEVER placed a cafe order. CTA: "Your first drink on us — code WELCOME5". Tracks conversion = first cafe_order in 14 days.
- **Win Them Back** — members who ordered 30+ days ago and not since. CTA: "We saved your usual" with their last item name pulled from order history. Tracks = new order within 14 days.
- **Habit Builder** — members with 1 lifetime order. CTA: "Order 3 more this month, get the 4th free" (manual fulfillment for now via a flag on the profile). Tracks = 2nd order within 14 days.

Each runs as **email** (works today, ~108 reachable) with an SMS option ready when opt-in grows. Uses the same `email_campaigns` + `goal_type` infra already built — adds three new goal types: `cafe_first_order`, `cafe_winback`, `cafe_habit`.

**3. Drink-of-the-Week Email Blast Tool** — lightweight composer specifically for cafe promo. Pulls a `cafe_menu_items` row, auto-fills product name + image + price into a pre-built MJML template. One click → sends to all active members with a "View on the way in" CTA linking to `/cafe`. Logs as a campaign with `goal_type: cafe_drink_of_week` so we measure week-over-week lift.

**4. SMS opt-in nudge in the cafe order confirmation flow**
Today, when a member places a cafe order through the portal, we don't ask for SMS opt-in. Add a one-line checkbox on the order confirmation page: *"Text me when it's ready (and the occasional drink special)"* — flips `profiles.sms_opt_in = true`. This is the cheapest way to grow the SMS list from 2 → 50+ in 30 days using the audience that's already most engaged.

**5. Free-Drink Voucher (manual issuance)**
Add a `cafe_vouchers` table with: `member_id`, `code`, `item_id` (nullable = any item up to $X), `expires_at`, `redeemed_at`, `redeemed_order_id`. Admin can grant from member detail page. Front Desk POS auto-applies the voucher when scanning the member. Used by playbooks #1 and #3 above. This is the actual incentive engine that makes the campaigns convert instead of being polite emails.

### Out of scope (for this PR)
- No changes to cafe checkout/Stripe flow itself.
- No menu redesign — assumes the 113 items are fine.
- No physical signage / in-club marketing copy.
- No loyalty tier / points integration (already exists in member_points; we can wire it in a follow-up once basic flow proves out).

### Technical notes
- `cafe_orders` already has `user_id`, `status`, `total_amount` (cents), `created_at` — all queries the dashboard needs.
- New goal_types added to `GOAL_TEMPLATE_MAP` and `GOAL_LABELS` in existing files.
- `cafe_vouchers` migration + simple RLS (members read own, staff manage all).
- Conversion attribution reuses the 14-day window pattern from existing playbooks.
- Order-confirmation SMS opt-in is a 5-line UI change in `src/pages/Cafe.tsx` (or wherever the confirmation step lives — will verify before implementing).

### Why this hits the target
The math: 108 active members × 25% First-Sip conversion (with free drink) = 27 first-time orderers in month 1. If half become 2×/month repeats at $7 = $189 recurring + the rest churn back. Habit Builder converts 30% of those into 4×/month = ~$224 each. Adding Win-Them-Back layered on top of existing one-timers compounds. Realistic landing: **$1.5k–$3k mo 1, $4k–$6k mo 2, $8k+ mo 3** — that's the pace to hit the Q3 target.
