# Deploy commit cd632adb (no code changes)

1. Redeploy edge functions: stripe-webhook, stripe-payment, charge-member-arrears, reconcile-billing, backfill-payment-history, stripe-failed-invoices (picks up shared billingReconciliation, invoicePeriod, paymentMethods).
2. After step 1 succeeds, apply `drizzle/migrations/0099_link_failures_to_later_payments.sql` exactly as written.
3. Do not call `apply_billing_link_repairs` and do not press any "Apply fixes" button.

Reply will list only which steps completed.
