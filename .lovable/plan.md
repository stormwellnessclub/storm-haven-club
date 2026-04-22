
Replace the legacy financial report lineup so `/admin/reports` only exposes the new payment-audit reports and no longer references the retired IDs.

1. Remove legacy financial report definitions
- Delete the old financial report entries from `src/lib/reportDefinitions.ts`:
  - `revenue-summary`
  - `next-month-projection`
  - `cash-flow-projection`
- Keep the new lineup as the canonical financial set:
  - `autopay-upcoming-charges`
  - `failed-payments`
  - `collected-revenue`
  - `projected-revenue`
  - `revenue-summary-dashboard`
- Preserve other non-legacy financial reports already in use (`daily-sales-breakdown`, `daily-revenue`, `sales-segmentation`, `revenue-by-category`, `payment-analysis`, `payment-follow-up`, `class-revenue-projection`, `sales-tax-collected`, `cafe-sales`).

2. Remove legacy report routing/mapping from the admin reports UI
- Update `src/components/admin/reports/ReportPreview.tsx`:
  - Remove imports for:
    - `RevenueSummaryReport`
    - `NextMonthProjectionReport`
    - `CashFlowProjectionReport`
  - Remove their entries from the `reportComponents` map.
- This ensures selecting reports by old IDs can no longer render legacy components.

3. Prevent stale selections from pointing to removed report IDs
- Update `src/pages/admin/Reports.tsx` to guard initial/active state:
  - If `selectedReportId` is missing from `getReportById`, clear it or fall back to the first available report in the selected category.
  - On category change, continue resetting the selection as it does now.
- This avoids blank states if an old report ID survives in UI state or deep-link behavior later.

4. Remove any remaining internal references to retired IDs
- Search the app for:
  - `revenue-summary`
  - `next-month-projection`
  - `cash-flow-projection`
- Remove or update any leftover references in admin navigation helpers, report launch buttons, or report-related utilities so only the new IDs remain reachable.

5. Keep legacy component files out of active use
- Since the goal is to remove routes/references, first detach the old components from the active reports system.
- If no other code imports them afterward, optionally remove:
  - `src/components/admin/reports/reports/RevenueSummaryReport.tsx`
  - `src/components/admin/reports/reports/NextMonthProjectionReport.tsx`
  - `src/components/admin/reports/reports/CashFlowProjectionReport.tsx`
- If deletion is deferred, they should remain fully orphaned and inaccessible from the UI.

6. Validation pass
- Verify the Financial category sidebar now shows the new lineup and no legacy items.
- Verify selecting every financial report resolves to a live component in `ReportPreview`.
- Verify no admin route, selector, or report map still points to the retired IDs.
- Verify the fallback state for an invalid report ID behaves cleanly instead of showing an outdated report.

Technical notes
- Files confirmed relevant:
  - `src/lib/reportDefinitions.ts`
  - `src/components/admin/reports/ReportPreview.tsx`
  - `src/pages/admin/Reports.tsx`
  - `src/components/admin/reports/ReportSidebar.tsx` (should update automatically from definitions)
- Current legacy exposure is coming from `ReportPreview.tsx`, where the old IDs are still mapped even though the new definitions already exist.
- `ReportSidebar.tsx` is definition-driven, so removing the old entries from `REPORTS` will automatically remove them from the visible report list.
