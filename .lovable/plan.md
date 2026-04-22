
Remaining from the approved 10-item list:

1. Reports overhaul is still not built
- The current financial report definitions still show the old reports (`revenue-summary`, `next-month-projection`, `cash-flow-projection`) instead of the planned set:
  - Autopay / Upcoming Charges
  - Failed Payments
  - Collected Revenue
  - Projected Revenue
  - Revenue Summary Dashboard
- `RevenueSummaryReport.tsx` still uses member records + pricing logic for revenue cards and still shows the old “Annual Run Rate” card.
- `CashFlowProjectionReport.tsx` still treats founding members as upfront Month 1 revenue, which conflicts with the approved rule.
- `NextMonthProjectionReport.tsx` is still an old mixed-category projection report, not the planned member billing projection view.

2. Report data rules still need to be enforced
- Collected revenue must come from successful `payment_attempts.amount`.
- Projected revenue must come from `next_billing_date`, `next_annual_fee_date`, and pricing rules only.
- Member dues and non-member transactions must not be mixed in the same report table.
- Founding members must be handled per the approved renewal rules, not the old one-time-upfront assumption.

3. Report UX still needs to be rebuilt
- Add the planned date-range presets across the new/rebuilt reports:
  - This Month
  - Last Month
  - Last 3
  - Last 12
  - Custom
- Add the planned filters for charge type and tier where applicable.
- Replace the old financial report lineup in the sidebar/preview mapping so the admin sees the new reports instead of the legacy ones.

4. Stripe subscription-updated sync likely still needs completion
- The webhook has the `customer.subscription.updated` branch, but it still needs to fully write the next billing date fields during subscription updates:
  - `members.next_billing_date`
  - `members.next_annual_fee_date`
- This is required so reports and member/payment UI stay current without depending only on the fetch function.

5. Member/non-member reporting separation needs to be reflected in admin reporting screens
- The non-subscription invoice handler is in place, but the reporting layer still does not expose:
  - failed payments report
  - collected revenue grouped by dues / annual fee / class pass / guest pass / POS
  - separate member vs non-member treatment in tables

6. Final validation pass is still needed
- Verify all successful invoice branches write `payment_attempts.metadata.charge_type` consistently.
- Verify non-member invoices land with `non_member_profile_id`.
- Verify the new next-payment dates drive:
  - member detail card
  - portal notices
  - upcoming/projection reporting

Already completed from the list:
- Database migration for `next_billing_date`, `next_annual_fee_date`, `non_member_profile_id`, supersede trigger rewrite, and arrears sync
- `get-autopay-dates` writes next dates back to members
- Hook fixes in `useMemberConfirmedIssues` and `useAutopaySchedule`
- `useNextMemberPayment` hook
- `NextPaymentCard` in member detail
- Member portal notices moved to separate dues vs annual-fee logic
- Non-subscription `invoice.payment_succeeded` handler in `stripe-webhook`

Recommended next build order:
1. Finish `customer.subscription.updated` next-date syncing
2. Rebuild financial report definitions/sidebar wiring
3. Replace `RevenueSummaryReport`
4. Replace `CashFlowProjectionReport`
5. Replace `NextMonthProjectionReport` with the planned projection/collected views
6. Add the new Failed Payments and Collected Revenue report surfaces
7. Run a final audit against the original “Must NOT Do” rules
