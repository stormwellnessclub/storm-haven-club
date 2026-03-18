

## Plan: Add Sales Tax Report

### What you'll get
A new "Sales Tax Collected" report under the Financial category in the Report Center (Admin → Reports). It will show all transactions that included sales tax, broken down by source (Café, Storm Shop, POS), with totals for the tax amount collected over the selected date range — useful for tax filing.

### Data sources
- **`cafe_orders`** — Café and Front Desk POS orders include a line item named "MI Sales Tax (6%)" in the `order_items` JSON array
- **`merch_orders`** — Storm Shop orders store tax in `tax_amount` column (or calculated from order totals)
- **`manual_charges`** — Admin charges that include tax notation in the description

### Steps

1. **Add report definition** to `src/lib/reportDefinitions.ts` — new entry `sales-tax-collected` under the `financial` category with filters for source type (Café, Merch, All)

2. **Create `SalesTaxReport` component** at `src/components/admin/reports/reports/SalesTaxReport.tsx`:
   - Query `cafe_orders` (completed) and extract tax line items from `order_items` JSON
   - Query `merch_orders` (completed) and extract tax amounts
   - Display summary cards: Total Tax Collected, Café Tax, Merch Tax
   - Show a table of individual taxed transactions with date, source, subtotal, tax amount, and total
   - Support date range filtering

3. **Register the component** in `ReportPreview.tsx` report components map

### Technical detail
- Tax line items in Café/POS orders are stored as `{ name: "MI Sales Tax (6%)", price: <amount>, quantity: 1 }` inside the `order_items` JSONB column
- The report will parse these JSON arrays client-side to extract tax amounts
- Merch orders may store tax separately or in order items — the component will handle both patterns

