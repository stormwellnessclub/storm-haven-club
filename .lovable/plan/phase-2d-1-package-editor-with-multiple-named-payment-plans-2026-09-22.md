# Phase 2D-1 — Package editor with multiple named payment plans

Build the package edit screen exactly as specified: one package, a "Pay in full" option, and any
number of named payment plans (4 Monthly Payments, 6 Monthly Payments, ...), each with its own
amount due at sale, installment count, frequency and status, with Edit / Duplicate / Archive per plan
and an "Add payment plan" action.

Today a package holds only a single plan shape — one on/off switch plus a number of months, split
equally, with no plan name and no down payment. That is the main thing this phase replaces.

## Where it lives

The editor moves into the Personal Training portal so the catalog stops being split across two
screens. `Personal Training → Packages → Edit` becomes the single place to create and edit packages
and their plans. The older Packs screen keeps working and points at the new editor.

## The screen

Header: package name, Active/Inactive badge, breadcrumb.

**Package details** — Name, Format, Sessions, Package price, Expiration (days), plus the existing
public / active / display-order / notes controls.

**Payment options**

- **Pay in full** — always listed, shows "$3,600 at checkout", can be switched off for a
  plan-only package.
- **Payment plans** — a card per plan showing: plan total, due at sale, future installments
  (count × amount), frequency, "First autopay date — chosen when package is sold", automatic
  charge, saved card required. Each card has Edit, Duplicate, Archive, and an Active badge.
- **+ Add payment plan** opens the plan form.

**Plan form fields**: plan name, number of payments, amount due at sale (dollar or percent, defaults
to an even share), frequency (monthly; weekly and biweekly available), whether remaining
installments are split evenly or set manually, active toggle. The form shows a live summary
("Plan total $3,600 · Due at sale $900 · 3 × $900") and blocks saving when the installments plus the
down payment do not equal the package price.

## What happens behind the screen

- A new table holds the plans, one row per named plan on a package, with its own Stripe recurring
  price kept in sync when the amounts change. Archived plans stay in place so packages already sold
  under them keep their history.
- Existing packages that use the old single-plan switch are carried over automatically into one
  named plan ("N Monthly Payments") so nothing in the catalog looks empty after the change. The old
  columns stay in the database, marked retired, and no records are deleted.
- The Sell Package flow keeps working during this phase: when a package has plans, staff pick from
  the named plans instead of the old checkbox, and the amount due at sale comes from the plan.
  Choosing the first autopay date, the dated schedule preview and the client billing views are the
  next phase and are not part of this one.

## Technical notes

- New table `pt_pack_payment_plans`: `pack_id`, `name`, `installment_count`, `down_payment_cents`,
  `installment_cents`, `frequency` (`monthly` | `weekly` | `biweekly`), `is_active`,
  `display_order`, `stripe_price_id`, timestamps. Grants for `authenticated` (read) and
  `service_role`; RLS write policies restricted to `has_any_role('super_admin','admin','manager')`;
  public read for active plans on public packs so the member-facing pages can price them.
- Backfill in the same migration from `pt_packs.allow_payment_plan` / `payment_plan_months` /
  `payment_plan_stripe_price_id`; `COMMENT ON COLUMN` marks those three as deprecated.
- `sync-pt-pack-plan-price` extended to take `plan_id` and write `pt_pack_payment_plans.stripe_price_id`,
  archiving the previous price. Existing pack-level behaviour kept for the deprecated path.
- New `src/pages/admin/pt/PTPackageEdit.tsx` at `/admin/pt/packages/:packId`, plus
  `PTPaymentPlanCard` and `PTPaymentPlanDialog` components; `PTPackages.tsx` Catalog rows link to it
  and gain Add / Edit / Duplicate / Archive.
- Hook `usePTPackPaymentPlans` (list, create, update, duplicate, archive) alongside `usePTPacks`.
- `SellPTDialog` reads the plans list; when present, the single `allow_payment_plan` checkbox is
  replaced by a plan selector and `admin-create-pt-payment-plan` receives `planId` and uses the
  plan's Stripe price and down payment amount. Date selection stays as-is this phase.
- Validation: `down_payment_cents + installment_count_excluding_down × installment_cents` must equal
  `pt_packs.price_cents`; enforced in the dialog and by a check constraint added `NOT VALID` then
  validated after backfill.
