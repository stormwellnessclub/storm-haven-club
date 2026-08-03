# Training Requests as a Printable / Exportable List

Make Admin → Training Requests behave as a plain list first: one row per request, easy to print on paper, and easy to move into another program (Excel, Google Sheets, a scheduling tool).

## 1. List first

- The log table becomes the default view when the page opens, instead of the card list.
- Cards stay available behind the view toggle for when you want the full detail of one request.
- Columns, in order: Client, Member (Yes/No), Phone, Email, Service, Requested days, Time frame, Original wording, Submitted, Status.
- Rows sort by submitted date (newest first) with a click-to-sort on Client and Submitted.

## 2. Print

- A **Print** button next to the existing exports opens the browser print dialog.
- A print stylesheet strips the admin sidebar, filters, buttons and colours so the paper copy is just a clean black-on-white table with a heading: "Training Requests — <service filter> — <date range>" and the print date.
- Table repeats its header row on each page and avoids splitting a row across pages.

## 3. Move into other software

- **Export CSV** stays, and gets the full column set above so nothing has to be retyped. One row per request, plain text dates (`2026-07-28`) and `Yes`/`No` for member, which import cleanly everywhere.
- Add **Copy to clipboard** — the same rows as tab-separated text, so you can paste straight into a spreadsheet without downloading a file.
- **Download PDF** stays for a fixed, shareable copy.

All three respect the active Service / Status / date filters.

## Technical notes

- `src/pages/admin/TrainingRequests.tsx`: default `viewMode` to the table, widen the row model to the full column set, add sort state, add Print and Copy buttons.
- Print: a `print:` Tailwind utility pass on the page plus a small `@media print` block for the table (repeat `thead`, `break-inside: avoid` on rows); no new dependency.
- CSV reuses the existing `downloadCsv` helper in `src/lib/ptExport.ts`; the clipboard copy reuses the same row builder with a tab delimiter.
- No database or backend changes.
