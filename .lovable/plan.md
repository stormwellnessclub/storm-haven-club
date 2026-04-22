
Implement the final cleanup so the admin reports area only exposes the new payment-audit lineup and cannot resolve retired financial report IDs.

1. Remove retired financial report IDs from definitions
- Update `src/lib/reportDefinitions.ts` to ensure the Financial category contains only the active audit reports plus the other still-supported financial reports.
- Remove any entries for:
  - `revenue-summary`
  - `next-month-projection`
  - `cash-flow-projection`
- Keep the new audit lineup:
  - `autopay-upcoming-charges`
  - `failed-payments`
  - `collected-revenue`
  - `projected-revenue`
  - `revenue-summary-dashboard`

2. Remove legacy preview mappings
- Update `src/components/admin/reports/ReportPreview.tsx`:
  - Remove imports for the old financial report components.
  - Remove any `reportComponents` map entries that still point to the retired IDs.
- Result: old IDs can no longer render any component even if selected somehow.

3. Harden report selection state
- Update `src/pages/admin/Reports.tsx` to keep `selectedReportId` valid:
  - If the current ID no longer resolves, automatically fall back to the first report in the current category.
  - Reset date range and filters to that fallback report’s defaults.
- This prevents blank or stale UI states from old selections or deep links.

4. Remove remaining references to retired report IDs
- Search the app for:
  - `revenue-summary`
  - `next-month-projection`
  - `cash-flow-projection`
- Remove or replace any remaining references in report launchers, helpers, navigation, or route-related logic so those IDs are fully unreachable.

5. Delete orphaned legacy report components
- Remove the inactive report files if nothing imports them anymore:
  - `src/components/admin/reports/reports/RevenueSummaryReport.tsx`
  - `src/components/admin/reports/reports/NextMonthProjectionReport.tsx`
  - `src/components/admin/reports/reports/CashFlowProjectionReport.tsx`

6. Validate the final report lineup
- Confirm the Financial sidebar only shows the new report lineup.
- Confirm every visible financial report resolves to a live component.
- Confirm retired report IDs no longer render and invalid selections gracefully fall back.
- Confirm there are no lingering internal references to the removed reports.

Technical details
- Files to update:
  - `src/lib/reportDefinitions.ts`
  - `src/components/admin/reports/ReportPreview.tsx`
  - `src/pages/admin/Reports.tsx`
- Files to remove:
  - `src/components/admin/reports/reports/RevenueSummaryReport.tsx`
  - `src/components/admin/reports/reports/NextMonthProjectionReport.tsx`
  - `src/components/admin/reports/reports/CashFlowProjectionReport.tsx`
- `ReportSidebar.tsx` is definition-driven, so once definitions are clean it should update automatically.
