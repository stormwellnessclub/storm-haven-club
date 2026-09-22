# Phase 2C.5B1 — Verification pass and completion report

The B1 work is already in place (new payment-plan table, package editor inside the Personal
Training portal, catalog actions). This task verifies it gate by gate, fixes only genuine B1
deficiencies, and returns the full report. No B2 or Phase 2D work.

## How verification runs

1. **Snapshot first.** Record row counts and row-level fingerprints for packages, payment-plan
   templates, sold packages, sale intents, session balances, appointments, PT invoices and
   payment history before anything is touched.
2. **Read-only database checks** for the gates that are pure data questions: legacy plan
   migration (Gate H), sold-package preservation (I), Stripe subscription preservation (J),
   legacy field presence (K), production preservation (T).
3. **Live screen checks** signed in as staff on the Packages screen and the package editor:
   create, edit, duplicate, activate/deactivate, public/private, search and filter, export,
   the payment-options column and the plan cards (Gates A, B, Q, R).
4. **Disposable test records** for the behaviour gates, all removed afterwards:
   - Pay-in-full-only package at $1,200 (Gate C)
   - One $3,600 package carrying both "4 Monthly Payments" ($900 at sale, 3 future) and
     "6 Monthly Payments" ($600 at sale, 5 future) (Gate D)
   - Unequal start: $3,600 with $1,200 at sale and 3 future payments of $800 (Gate E)
   - Uneven division: $1,000 with $100 at sale and 7 future payments, with the exact cent
     schedule returned (Gate F)
   - Duplicate one package with both plans and confirm new IDs and nothing client-related
     copied (Gate N)
   - Archive one plan and confirm it disappears from future sale options while staying on
     record (Gate M)
5. **Rejection checks sent straight to the database, bypassing the screens** (Gate O): negative
   total, negative amount due at sale, amount due at sale above the total, zero future
   installments, invalid frequency, missing package, totals that do not reconcile.
6. **Permission checks** as a non-privileged role attempting each package and plan mutation
   (Gate P), confirming the server refuses even when the buttons are bypassed.
7. **Scope check** (Gates G and S): confirm no client billing date lives on a package template
   and document precisely any sale-side behaviour already present, without changing it.
8. **Close the loop.** Re-run the snapshot and compare row by row; confirm no Stripe calls and
   no card charges occurred.

## Fixes

Only failures that belong to B1 get fixed — a missing catalog action, a plan card field that is
not shown, a validation hole, a permission hole. Each fix is followed by a re-test of that gate
alone. Anything that belongs to the sale flow, autopay dates, dated schedules or client billing
views is recorded as a B2 note instead of being built.

## What comes back

The 18-point completion report (tables and fields, route behaviour, create/edit, plan template
structure, legacy migration count and details, legacy compatibility strategy, duplicate,
archive, historical agreement protection, validation, permissions, Stripe price sync, runtime
tests, before/after comparison, remaining limitations, B2 notes), PASS or FAIL for each gate
A–T, and exactly one closing status line.

## Technical notes

- Tables in scope: `pt_packs`, `pt_pack_payment_plans`, `pt_passes`, `pt_sale_intents`,
  `pt_payments`, `pt_invoices`, `pt_appointments`, `pt_session_usage`.
- Validation is enforced by the `pt_pack_payment_plan_validate` trigger and row-level security
  restricted to super_admin / admin / manager; both are exercised directly, not through the UI.
- Screens: `src/pages/admin/pt/PTPackages.tsx`, `src/pages/admin/pt/PTPackageEdit.tsx`,
  hooks `usePTPackages.ts` and `usePTPackPaymentPlans.ts`. The legacy Packs screen stays.
- Migrations 0045 and 0046 are already applied; no new migration is expected unless a gate
  exposes a real validation or permission gap.
- Live checks use the staff session at localhost; no production email, no Stripe write calls.
