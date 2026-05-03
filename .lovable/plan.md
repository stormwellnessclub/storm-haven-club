
# Café Upsell Engine — Phase 1: Functional Smoothie Line + A/B Framework

Lift café attach rate from 26% → 40%+ by combining (1) a hero "Functional Smoothie Line" treatment, (2) high-intent surface placement (post-class, portal, booking confirm), and (3) a real A/B framework so we know what works. Same plumbing extends later to missed-membership and non-member upsells.

The Strawberry Glaze ($18, already in the menu) is the launch hero — Storm's answer to the viral Erewhon smoothie, only better (Organic Sea Moss, Hyaluronic Acid, 3 Collagens, Colostrum, Healthy Fats, Vitamin C). Sample retouched product photo and editorial promo card already approved above.

---

## Part 0 — Fix SMS first (prerequisite)

SMS has never actually worked end-to-end. Before we build any post-class SMS upsell, we fix the pipeline.

**Diagnose:**
- Audit existing Twilio code paths (class reminders, waitlist, support — anywhere we've called Twilio).
- Check whether the project is using the **Twilio connector via the Lovable gateway** vs. raw API creds. Per project memory, current attempts use direct REST. We'll move everything to the connector gateway pattern (`connector-gateway.lovable.dev/twilio/Messages.json`), which handles auth + token refresh.
- Verify `TWILIO_API_KEY` + `LOVABLE_API_KEY` are present in edge function env.
- Pull last failed Twilio attempts from `supabase--edge_function_logs` to see exact error (most likely: bad creds, unverified From number, or geo-permission block).

**Fix + harden:**
- New shared edge function `send-sms` — single entry point, validates input with Zod, gateway-based, logs every attempt to a new `sms_log` table (`to`, `body`, `status`, `error`, `provider_sid`, `purpose`, `member_id`, `created_at`).
- Member opt-in: add `sms_opt_in boolean` + `phone_verified boolean` to `members` (and `non_member_profiles`). Portal Profile gets an SMS toggle and a one-time verification flow (send 6-digit code → confirm).
- Add a small admin **SMS Health** page: send a test message to any number, view last 50 sends with status, see today's send count + failures.
- Enable Twilio **SMS Pumping Protection** + **SMS Geo Permissions** (US/CA only) on the Twilio side — call out in setup notes.

**Acceptance:** I can send a test SMS from the admin panel to a real phone, see it logged, and an opted-in member receives a class-reminder SMS without manual intervention.

Once this works, SMS becomes a real channel for the upsell engine **and** retroactively fixes class reminders, waitlist notifications, and freeze/billing alerts.

---

## Part 1 — Functional Smoothie Line (Menu Story)

**Schema additions to `cafe_menu_items`:**
- `is_featured boolean`, `feature_label text`, `tagline text`
- `key_benefits text[]` (bullet ingredients)
- `feature_starts_at`, `feature_ends_at`, `feature_discount_pct`
- `viral_inspiration text` (internal note)

**New table `cafe_menu_collections`** — group items into named lines (Functional Smoothie Line, Recovery Stack, Morning Boost). Items get a `collection_id`. Lets you launch whole "lines" with shared branding/photography.

**Admin UI** — `CafeMenuManager` gets:
- **Specials & Features** tab — toggle featured, schedule window, % off, set tagline + benefits.
- **Collections** tab — create collection, set hero image + description, drag items in.

**Strawberry Glaze**: I'll mark it featured, set price to **$18**, attach the cleaned hero photo, set tagline + benefits per the approved promo card. (You said it's already in the menu — I'll update it in place rather than create a duplicate.)

---

## Part 2 — Member-Facing Display

**`/cafe`:**
- Hero strip: **"The Functional Smoothie Line"** carousel — full-bleed photo, tagline, ingredient pills, price.
- "Today at the Café" specials row beneath.
- Existing menu sits below the heroes.

**Portal Dashboard:**
- "From the Café" widget — rotates featured items, one-tap **Pre-order** CTA.

Look/feel: cream + burgundy editorial — same direction as the approved Strawberry Glaze promo. I'll generate matching hero shots for each Functional Smoothie you send me.

---

## Part 3 — Post-Class Café Prompt

Surfaces (gated on rules below):
1. **Portal dashboard banner** — "You just crushed Reformer. Refuel with The Strawberry Glaze."
2. **Booking-confirmation footer** — "Pre-order your post-class smoothie."
3. **SMS** (5 min before class ends) — "Your Strawberry Glaze can be ready when you walk out. Tap to order." — **only after Part 0 is green**, and only for opted-in members.

**Rules:**
- Trigger only if class end is within ±60 min OR upcoming class within 30 min.
- Suppress if `cafe_orders` row in last 4 hr OR `sms_opt_in = false`.

---

## Part 4 — Pre-Order from the App

`cafe_orders` already exists, so this is mostly UI:
- New **`/portal/cafe`** — browse menu (Functional Line first), cart, pickup time picker ("Now / In 10 min / After my next class").
- Charges via existing manual-charge / saved-card flow.
- Pushes to admin **CafePOS** queue with `pending` status; staff sees it on the kiosk.
- Member gets push + SMS (once Part 0 is done) when staff marks `completed`.

---

## Part 5 — Bundle / Credits

A/B-tested mechanics:
- **"Class + Smoothie" bundle** at booking: optional "+$10 add a Functional Smoothie (save $4)". Creates a tied `cafe_orders` row, ready at class end.
- **Café credit pack**: $50 → $60, $100 → $125. New small ledger table, debited at POS. Same pattern as wellness credits.

---

## Part 6 — A/B Framework (Reusable)

**New tables:**
```text
experiments (id, key, name, status, started_at, ended_at, target_metric)
experiment_variants (id, experiment_id, key, name, config jsonb, is_control)
experiment_assignments (id, experiment_id, variant_id, user_id, member_id, assigned_at)
experiment_events (id, experiment_id, variant_id, user_id, event_type, value numeric, metadata jsonb, created_at)
```

**RPC `assign_experiment_variant(_key, _user_id)`** — deterministic hash bucketing, sticky per user.

**Client hook `useExperiment(key)`** — returns `{ variant, track(event, value?) }`.

**Initial experiments:**
| Key | Variants | Surface |
|---|---|---|
| `cafe_post_class_prompt` | control / banner / modal / sms | Portal + booking confirm |
| `cafe_smoothie_line_hero` | control / carousel / single-hero | Cafe + portal |
| `cafe_bundle_at_booking` | control / +$10 / 20%-off-add-on | Booking flow |
| `cafe_credit_pack` | control / $50→$60 / $100→$125 | Portal |

---

## Part 7 — Reporting (by Day + Class Type)

New admin report **Café Attach Performance**:
- KPIs: attach rate, avg ticket, revenue/check-in, repeat-buy rate, pre-order vs walk-up split.
- By day of week, by class type (joins `class_sessions` → `bookings` → café charges within ±90 min of class end), by time-of-day, by experiment variant (lift vs control, sample size, 95% CI).
- CSV/PDF export.

---

## Part 8 — Roadmap (next phases)

Same plumbing extends to:
- Missed-membership re-activation (frozen >30 days) with offer A/B
- Non-member → member conversion prompts (guest-pass, class-pass users)
- Spa attach off recovery bookings

---

## Build Order

1. **Part 0 — Fix SMS** (blocks all SMS variants)
2. Schema + admin specials/collections UI (Part 1) + update Strawberry Glaze to $18 featured
3. Member-facing Smoothie Line on /cafe + portal home (Part 2)
4. Experiments framework + reporting (Parts 6 + 7) — gets baseline before tests
5. Post-class prompt (Part 3) — in-app first, SMS once Part 0 ships
6. Pre-order flow (Part 4)
7. Bundle + credit pack (Part 5)

---

## Technical Notes

- Reuse `manual_charges` for café POS; pre-orders link `cafe_orders.id` in metadata.
- Suppression checks `cafe_orders` + `manual_charges WHERE description ILIKE 'Cafe%'` last 4 hr.
- Experiment writes via RLS-protected RPCs only.
- Reporting joins `bookings.session_id → class_sessions.class_type_id` for class-type breakdown.
- Timezone `America/Chicago` everywhere.
- All SMS routed through new `send-sms` edge fn → Twilio connector gateway → `sms_log` table.

---

## What I need from you

1. **Approve the plan.**
2. **Recipes for the rest of the Functional Smoothie Line** (names + ingredients) so I can generate matching hero photos + promos for each.
3. **Café credit pack pricing** — confirm $50→$60 / $100→$125, 90-day expiry?
4. **Twilio From number** — confirm which Twilio phone number we should send from (or do you want me to use the one already in env / pick one in Twilio).

Once approved I start with **Part 0 (fix SMS)** in parallel with **Part 1 (schema + admin)** so the Strawberry Glaze can go live this week regardless of SMS timing.
