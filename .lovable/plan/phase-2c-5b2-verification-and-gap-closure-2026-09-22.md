# Phase 2C.5B2 — Verification and Gap Closure

Goal: run all 30 gates (A–AD) against the completed Sell Package + Payment Plan + Autopay workflow, fix only genuine B2 deficiencies, and return the full completion report with one status line.

## The one blocker

Gates that move money cannot run today. Storm's payment account is currently connected with live keys only, so any real charge would hit a real card. The rule "never charge a real production card" stands, so those gates stay unrun until a test-mode key is available.

To unblock, I need a Stripe **test mode** secret key (starts with `sk_test_`) stored as a separate secret. The payment functions would then read that key when a sale is flagged as a test sale, so verification never touches live money. Nothing in the live sale path changes.

Affected gates: A, M, N, O, Q, R, S, T, U, V, W, and the money portion of Y.

## What runs now, without any payments

These gates are verified by reading the actual stored records, the schedule functions, and the staff screens with a real staff login:

- B — only active plans attached to the package appear; archived ones do not; selected template travels with the sale
- C, D — provenance and immutable snapshots survive a template edit
- E — a first autopay date different from the sale date is honored end to end
- F — late-evening Detroit timestamps do not shift any displayed or stored date
- G — billing day 31 clamps to short months and returns to 31 afterwards, no permanent drift
- H — one authoritative row per installment, with due date, amount, status and payment references
- I, J — schedule totals land exactly on the package price, including a plan that does not divide evenly
- K — pre-sale preview shows every required field and matches what gets stored
- L — saved cards show brand, last four, expiration and default, and a non-default card can be chosen
- P — the old "30 days per month" end-date estimate is gone for new plans
- X — archiving a template after a sale leaves the sold agreement and schedule untouched
- Z — pay-in-full and payment-plan sales stay clearly distinct
- AA — unauthorized roles are rejected on every server action
- AB — paid and historical installments cannot be casually edited
- AC — production counts before and after are identical
- AD — the data a future client billing screen would need is present

All testing uses disposable packages, plans and client records, deleted afterwards.

## Then, once the test key exists

Run the payment gates on a disposable test client: pay in full, the $3,600 / $900 plan, add a test card inside checkout, double submit, a forced mid-sale failure and retry, a successful future installment webhook, a replayed duplicate webhook, a failed installment and its retry, and a Storm-versus-Stripe date and amount comparison for every installment.

## Fixes

Any gate that fails gets a narrow fix inside the B2 surface only — the sale dialog, the payment-plan function, the schedule functions, the webhook, or the staff billing view. No redesign, no B3, no Phase 2D.

## Deliverable

The 19-point report plus every gate marked PASS or FAIL, ending with exactly one status line.

## Technical notes

- Records: `pt_payment_plan_installments` (authoritative), `pt_passes` (sold agreement + snapshot), `pt_sale_intents` (checkout provenance).
- Functions: `pt_build_plan_schedule`, `pt_plan_schedule_preview`, `pt_attach_plan_schedule`, `pt_materialize_plan_installments`, `pt_reconcile_installment`, `pt_bind_plan_subscription`.
- Server: `admin-create-pt-payment-plan`, `stripe-webhook`, `stripe-payment` (`create_admin_setup_intent`).
- UI: `SellPTDialog.tsx`, `PTBilling.tsx`, `usePTPlanInstallments.ts`.
- Test-mode routing would be an explicit per-sale flag read server-side; no change to live behavior.
