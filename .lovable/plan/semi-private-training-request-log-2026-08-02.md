# Semi-Private Training Request Log

Turn the existing Training Requests admin page into a usable scheduling log: filter to Semi-Private, see each client's requested days and time frames at a glance, spot overlapping groups, and download the log as PDF or CSV.

There are currently 17 requests on file (13 semi-private, 4 one-on-one), each with the client's own free-text "preferred times" note — for example "Mon wed Friday 8am" or "6 am or after 6 pm on Monday, Wednesday, Thursday."

## 1. Filters and a log view

On Admin → Training Requests, add:

- **Service filter** — All / Semi-Private / One-on-one (defaults to All, one click to Semi-Private).
- **Status filter** — All / New / Contacted / Scheduled / Closed.
- **Date range** — all time by default, with quick presets (last 30 days, last 90 days).
- **Log view toggle** — a compact table beside the existing card list:

```text
Client            Member  Requested days      Time frame            Submitted    Status
Susu Berry        Yes     Mon, Wed, Fri       8:00 AM               Jul 28       New
Nadeen Aoun       No      Mon, Wed, Fri       After 4:00 PM         Jul 31       New
Nadine Atoui      Yes     Mon, Wed, Thu ...   6 AM or after 6 PM    Jul 12       New
```

Each row also shows the client's exact original wording underneath, so nothing is lost in interpretation.

## 2. Automatic day and time parsing

Since clients type their availability freely, the log reads that text and pulls out:

- **Days** — recognises Mon/Monday/M, weekday and weekend shorthand, and ranges like "Monday - Saturday".
- **Times** — recognises "8am", "5:30", "530", "after 4pm", "2 pm", "mornings", "evenings", and turns them into readable chips.

Anything that can't be confidently read is flagged **Unparsed** and shown as the raw text, so you can eyeball it rather than trust a bad guess.

## 3. Grouping view for building semi-private groups

A **Group by day** panel showing, for each weekday, which clients asked for that day and in which window (morning / midday / evening). This makes clusters obvious — for example everyone wanting Mon/Wed/Fri mornings lands in one bucket, so you can see which group sessions are worth putting on the schedule.

## 4. Download the log

Two buttons above the table, respecting the active filters:

- **Download PDF** — a printable log titled "Semi-Private Training Requests" with the date range, client name, contact, member status, requested days, time frame, original text, and status.
- **Export CSV** — same columns for spreadsheet work.

## Technical notes

- No database changes needed. The `training_requests` table already stores `service`, `full_name`, `email`, `phone`, `preferred_times`, `is_member`, `status`, `admin_notes`, `created_at`.
- New helper `src/lib/parsePreferredTimes.ts`: pure function returning `{ days: number[], timeChips: string[], bucket: 'morning'|'midday'|'evening'|null, parsed: boolean }` from the free-text field, with unit-testable regex rules.
- `src/pages/admin/TrainingRequests.tsx`: add filter state, a `LogTable` sub-component, a `GroupByDay` panel, and the export buttons.
- PDF via the existing `jspdf` + `jspdf-autotable` pattern used by the spa payroll export; CSV via the existing `downloadCsv` helper, so styling and behaviour match the rest of admin.
