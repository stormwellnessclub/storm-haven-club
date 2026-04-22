

## Export all payment-processing code as a single Claude-readable audit bundle

### What you'll get

One downloadable Markdown file — `payment-system-audit.md` — that contains every piece of code involved in payment processing across the system, organized so Claude (or any LLM) can ingest the whole flow in one paste and run a thorough audit.

### What's included

The bundle is grouped into seven sections, in flow order:

**1. Overview & flow map**
- A written architecture summary: how a charge moves from Admin → Stripe → Webhook → Database → Application Portal → Member Portal.
- A table of every Stripe event the system listens for and what it triggers.
- The list of every database table involved (`payment_attempts`, `billing_arrears`, `card_sync_failures`, `members`, `applications`, `webhook_events`, `payment_method_audit`, etc.).

**2. Database layer (SQL)**
- Schema and RPCs for: `payment_attempts`, `billing_arrears`, `card_sync_failures`, `webhook_events`.
- Every payment-related RPC: `get_member_arrears_summary`, `reconcile_arrear`, `process_member_scan` (billing-block enforcement), `deactivate_member`, sync helpers, classification functions.
- All migrations from `supabase/migrations/` that touched these tables/functions, in chronological order.

**3. Edge functions (server-side Stripe logic)**
Full source of:
- `stripe-payment/index.ts` (~7,000 lines — the core charge engine: subscriptions, one-shots, POS, deactivation, card sync, manual charges)
- `stripe-webhook/index.ts` (~3,200 lines — every event handler: `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.created`, `charge.dispute.*`, `customer.subscription.*`, `setup_intent.*`)
- `reconcile-arrear/index.ts` (manual retry of an unpaid invoice)
- `backfill-payment-history/index.ts` and `backfill-disputes/index.ts` (the importers that created the 118 historical rows)
- `stripe-failed-invoices/index.ts`, `payment-tracking-health-check/index.ts`, `sync-subscription-status/index.ts`, `stripe-config/index.ts`

**4. Frontend hooks (data layer between UI and DB/edges)**
- `useMemberConfirmedIssues.ts`, `useMemberArrears.ts`, `useMembersBillingIssues.ts`, `useUnresolvedFailedCount.ts`
- `useAdminMemberBillingHealth.ts`, `useAdminMemberPaymentMethods.ts`, `useAdminPaymentTimeline.ts`, `useAdminPayments.ts`, `useAdminTransactions.ts`, `useAdminRefunds.ts`
- `useArrearsReconciliation.ts`, `useCardSyncStatus.ts`, `useFailedPaymentsHistory.ts`
- `usePaymentStatus.ts`, `usePaymentTracking.ts`, `useUserMembership.ts`, `useMemberBenefitsStatus.ts`, `useApplicationStatus.ts`, `useAutopaySchedule.ts`

**5. Admin UI components (where payments are managed)**
- Member Detail billing surface: `ConfirmedPaymentIssues.tsx`, `ArrearsCard.tsx`, `MemberArrearsBanner.tsx`, `MemberArrearsIndicator.tsx`, `MemberIssuesBadges.tsx`, `BillingHealthCard.tsx`, `BillingHealthWidget.tsx`, `ArrearsClassificationBadge.tsx`
- Charge actions: `ChargeItemSelector.tsx` (manual charge cart), `AdminChargeWith3DS.tsx`, `InitiationFeeChargeDialog.tsx`, `MarkPaidDialog.tsx`, `RefundDialog.tsx`, `AddProcessingFeesButton.tsx`
- Subscriptions: `SubscriptionCard.tsx`, `CreateSubscriptionDialog.tsx`, `CreateInitiationFeeSubscriptionDialog.tsx`, `EditAnnualFeeSubscriptionDialog.tsx`, `TierChangeDialog.tsx`, `ChangeBillingDateDialog.tsx`
- Failed-payments surfaces: `FailedPaymentsTab.tsx`, `FailedPaymentDetailSheet.tsx`, `FailedPaymentsHistory.tsx` (page), `PaymentTracking.tsx` (page), `SuccessfulPaymentsTab.tsx`, `StripeLivePaymentsTab.tsx`, `PaymentTimeline.tsx`, `PaymentsTabContent.tsx`
- Admin reports tied to billing: `PaymentAnalysisReport.tsx`, `PaymentFollowUpReport.tsx`, `CashFlowProjectionReport.tsx`, `NextMonthProjectionReport.tsx`, `RevenueSummaryReport.tsx`
- Card management: `AddApplicantCardModal.tsx`, `AdminAddCardForm.tsx`, `CardSyncFailuresWidget.tsx`, `BackfillPaymentHistoryDialog.tsx`, `NonMemberStripeImport.tsx`
- POS: `CafePOSCart.tsx`, `POSCustomerSearch.tsx` and `pages/admin/CafePOS.tsx`, `pages/admin/FrontDeskPOS.tsx`

**6. Application portal (apply → pay initiation → activate)**
- `pages/Apply.tsx`, `components/ApplicationProgress.tsx`, `components/PaymentSectionEnhanced.tsx`, `components/StripeProvider.tsx`
- `components/admin/Applications.tsx` (approval/cancel flow that creates the "applied but never charged" / "initiation only" buckets)
- `components/admin/SingleActivationDialog.tsx`, `BatchActivationDialog.tsx`, `AbandonedApplicationsTab.tsx`
- `components/admin/SellMembershipPackage.tsx`

**7. Member & non-member portals (where members see their own billing)**
- `components/member/`: `ActivationRequired.tsx`, `AddCardModal.tsx`, `AnnualFeeNotice.tsx`, `ApplicationUnderReview.tsx`, `BillingSummary.tsx`, `InlineBillingSection.tsx`, `MembershipActivationPayment.tsx`, `PaymentDueNotice.tsx`, `PaymentRequiredAlert.tsx`
- `pages/member/`: `Membership.tsx`, `PaymentHistory.tsx`, `PaymentMethods.tsx`, `FreezeRequest.tsx`
- `pages/portal/PaymentMethods.tsx`
- `components/ChargeHistory.tsx`
- Shared libs: `lib/billingTerminology.ts`, `lib/processingFee.ts`, `lib/stripeErrors.ts`, `lib/stripeProducts.ts`

### Format

Plain Markdown, one file. Each source file is preceded by a heading with its path and a one-line description, then fenced in a language-tagged code block (` ```typescript ` / ` ```sql `). Total file is expected to be ~1.5–2 MB of text — large but well within Claude's context window when pasted as an attachment.

A short table of contents at the top lets Claude jump to any layer. The intro section frames the audit goal: *"Find every place where a payment failure, retry, dispute, cancellation, or arrear can be created, resolved, displayed, or missed — and identify gaps causing inaccurate 'Confirmed Payment Issues' rows."*

### Deliverable

Single artifact written to `/mnt/documents/payment-system-audit.md`, downloadable from the chat. No code changes to the project.

### Technical details

- One-shot script reads each file listed above and concatenates them with headings + fenced blocks.
- Migrations are filtered to only those touching payment tables/RPCs (already enumerated — 26 files).
- A small generated "flow map" section at the top summarizes Stripe → webhook → DB → hook → UI relationships so Claude doesn't have to infer it.
- File is plain UTF-8 Markdown, safe to paste or upload to any LLM.

