

## Export payment-processing code as a downloadable ZIP of original source files

### What you'll get

A single ZIP archive — `payment-system-audit.zip` — containing every payment-related file in the project, preserved with their **original filenames and extensions** (`.ts`, `.tsx`, `.sql`) and their **original folder structure**. No Markdown wrapping, no concatenation. Drop it into Claude (or any tool) and it sees real source files.

### Archive layout

```text
payment-system-audit.zip
├── README.md                          ← flow map + file index (the only generated file)
├── supabase/
│   ├── functions/
│   │   ├── stripe-payment/index.ts
│   │   ├── stripe-webhook/index.ts
│   │   ├── reconcile-arrear/index.ts
│   │   ├── backfill-payment-history/index.ts
│   │   ├── backfill-disputes/index.ts
│   │   ├── stripe-failed-invoices/index.ts
│   │   ├── payment-tracking-health-check/index.ts
│   │   ├── sync-subscription-status/index.ts
│   │   └── stripe-config/index.ts
│   └── migrations/
│       └── (all payment-related migrations, original filenames preserved)
└── src/
    ├── hooks/                         ← all 20 payment hooks
    ├── components/admin/MemberDetail/ ← billing surface components
    ├── components/admin/              ← charge/subscription/failed-payment components
    ├── components/member/             ← member-facing billing components
    ├── components/                    ← shared (StripeProvider, ChargeHistory, etc.)
    ├── pages/admin/                   ← PaymentTracking, FailedPaymentsHistory, POS pages
    ├── pages/member/                  ← Membership, PaymentHistory, PaymentMethods
    ├── pages/portal/PaymentMethods.tsx
    ├── pages/Apply.tsx
    └── lib/                           ← billingTerminology, processingFee, stripeErrors, stripeProducts
```

The same file list from the previously approved bundle — only the packaging changes.

### The one generated file: `README.md`

A short index at the root of the zip with:
- The Stripe → webhook → DB → hook → UI flow map
- The list of every Stripe event handled and what it triggers
- A table of contents pointing to each included file by relative path
- The audit goal framing (find every place a failure/retry/dispute/cancellation/arrear is created, resolved, displayed, or missed)

### Deliverable

`/mnt/documents/payment-system-audit.zip` — a single downloadable archive containing real `.ts` / `.tsx` / `.sql` files in their original structure, plus a `README.md` index.

### Technical details

- Script reads the same file list used for the Markdown bundle and copies each into a staging directory at its original repo-relative path.
- Migrations are filtered to only those touching `payment_attempts`, `billing_arrears`, `card_sync_failures`, `webhook_events`, or related RPCs (already enumerated previously).
- `README.md` is generated fresh from the flow-map content used in the prior bundle.
- Final step: `zip -r /mnt/documents/payment-system-audit.zip .` from the staging dir.
- No code changes to the project. No edge functions touched.

