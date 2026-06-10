# Personal Training — Pricing, Admin Sell Flow & Backend Management

## 1. Pricing model (what I'll build in)

**1:1 Personal Training**
- Single session — **$120** — 2-week expiration
- 10-pack — **$1,100** ($110/session) — 3-month expiration

**Reformer Pilates 1:1**
- Single session — **$110** — 2-week expiration
- 5-pack — 2-month expiration — **price TBD (you'll fill in)**
- 10-pack — 3-month expiration — **price TBD**

**Semi-Private (max 4)** — bundle-only on public site
- 10-pack — $55/session = $550
- 20-pack — $55/session = $1,100
- 30-pack — $55/session = $1,650
- 45-pack — **$50/session** = $2,250
- *(Tell me which pack sizes to actually show — I'll default to 10/20/30/45)*
- Single session ($55) — **admin-only**, hidden from public site
- Pack expirations — **you'll set per pack in the admin config screen** (see §4)

I'll wire all of the above as the defaults. You can override every price and expiration from the new admin config page without touching code.

## 2. Public site changes
- Update `/personal-training/one-on-one`, `/private-pilates`, `/semi-private` pricing tiles with the numbers above.
- Pricing tiles are read from the same config table the admin edits — no hard-coded prices in the page.
- Semi-private public page shows packs only (no single).
- "Request a Session" form stays unchanged — clients still inquire, don't buy online.

## 3. New "Sell Personal Training" admin dialog
Separate dialog (not bolted onto Sell Class Package). Lives behind a **"Sell PT"** button on the member/non-member detail page and on the new admin PT page.

Fields:
- Customer search (members + non-members, same pattern as `SellClassPackage`)
- **Format**: 1:1 PT · Reformer 1:1 · Semi-Private
- **Pack**: dropdown of configured packs for that format (incl. admin-only Semi-Private single)
- **Quantity**: integer ≥ 1 (so you can sell, e.g., 3× single sessions at once)
- **Activation date** (default today) — editable
- **Expiration date** — auto-calculated from activation + pack's expiration rule, **editable**
- **Member pricing toggle** — only relevant if you decide to add member discounts later; default off for PT
- **Payment**: charge card on file · generate payment link · mark paid offline
- Review screen: line items, subtotal, 6% MI tax (if applicable to PT — confirm), gross-up processing fee, total
- On confirm: charges via existing Stripe infra, creates `personal_training_passes` rows (one per session-credit bucket), logs to admin action log

## 4. Backend management (where you go to manage this)

Two new admin pages, both under **"Personal Training"** in the sidebar (new group):

**`/admin/personal-training/packs`** — Pricing & pack config
- Table: format · pack name · sessions included · price · expiration (days or months) · public visibility toggle · active toggle
- Add / edit / archive packs. Edits flow to public pages and the Sell PT dialog instantly.
- This is where you'll add Reformer 5-pack price, adjust Semi-Private exp windows, hide the Semi-Private single from public, etc.

**`/admin/personal-training/passes`** — Sold passes / sessions
- Master-detail list of every PT pass sold: customer, format, sessions remaining, activation, expiration, status.
- Per-row: edit activation/expiration, add/remove sessions, refund, transfer, deactivate.
- Filter by format, expiring soon, exhausted.

**`/admin/training-requests`** (already exists) — leave as the inquiry inbox.

Sidebar group "Personal Training" will contain: Requests · Packs · Passes.

## 5. Member portal
- New "My Personal Training" card on the member dashboard showing remaining sessions and expiration per active pack.
- Booking still goes through the existing `TrainingRequestForm` (preselects format, pre-fills member info) — admin schedules and decrements a session via the Passes screen.

## 6. Data model
New tables (migration):

**`pt_packs`** — config rows that drive both public pricing tiles and the sell dialog
- `format` (`one_on_one` | `reformer_one_on_one` | `semi_private`)
- `name`, `sessions`, `price_cents`, `expiration_days`, `is_public`, `is_active`, `display_order`
- Seeded with the prices above.

**`pt_passes`** — purchased packs
- `user_id`, `pack_id`, `sessions_total`, `sessions_remaining`, `activated_at`, `expires_at`, `status`, `stripe_payment_id`, `sold_by_admin_id`

**`pt_session_usage`** — audit of each session decrement
- `pass_id`, `used_at`, `used_by_admin_id`, `notes`

RLS: members read their own; staff/admins full access. Standard GRANTs.

## 7. Out of scope (v1)
- Online booking calendar for PT (still inquiry-based).
- Trainer assignment / payroll splits.
- Auto-reminders for expiring PT packs (can layer in later via the existing cron infra).

## What I still need from you (can fill in after build)
1. **Reformer 1:1 5-pack and 10-pack prices**.
2. **Which Semi-Private pack sizes** to show publicly (default 10/20/30/45).
3. **Semi-Private pack expirations** (e.g. 10-pack 3mo, 20-pack 4mo, 45-pack 6mo?).
4. Confirm **6% MI sales tax applies to PT services** (yes/no) — affects checkout math.

If you say "go", I'll build with the defaults above; you can tune everything from the new Packs admin page right after.