## Therapist Payroll Generator

A new admin tool to generate per-therapist pay summary PDFs for any date range, matching the existing Teresa Tyler 4/9–4/18 layout.

### What you'll see

New page: **Admin → Spa Management → Payroll** tab

1. **Pick therapist** (dropdown of active therapists)
2. **Pick pay period** (start + end date — quick presets: "Last 2 weeks", "This period")
3. **Auto-loaded summary** pulled from completed appointments:
   - Service hours grouped by 90-min / 60-min / other durations
   - 15-min prep per session (auto-added per completed session)
   - CC tips list — one row per appointment with customer name (member's full name or "Walk-in")
   - Cash tips section (any completed appt with `payment_method='cash'` and tip_amount > 0)
4. **Edit before export**: any row editable — add/remove tip rows, rename customer (e.g. "Shams Mother in Law"), adjust amounts, override hours
5. **Generate PDF** — downloads `pay_summary-{Name}_{start}_TO_{end}.pdf` matching the existing format exactly (blue table headers, totals box, footer note about cash tips)

### Pay calculation rules

- Only `status = 'completed'` appointments count toward hours and CC tips
- Service hours = sum of `duration_minutes / 60` per service-duration bucket × therapist's hourly rate
- Prep time = 15 min × number of completed sessions × hourly rate
- CC tips = sum of `tip_amount` where `payment_method = 'card'`
- Cash tips shown separately (already paid out, excluded from "Total to Pay")
- **Total to Pay** = Service Hours + Prep + CC Tips

### Therapist hourly rate

Add `hourly_rate numeric(8,2) DEFAULT 26.00` to `spa_therapists`. Editable from the existing therapist edit dialog (`SpaTherapistsTab.tsx`). Each therapist can have their own rate; defaults to $26.

### Technical details

**Migration**
- `ALTER TABLE spa_therapists ADD COLUMN hourly_rate numeric(8,2) NOT NULL DEFAULT 26.00`
- New RPC `get_therapist_payroll(_therapist_id uuid, _start date, _end date)` returns JSON: appointments grouped by duration, list of CC tips with customer name, list of cash tips, totals. Uses SECURITY DEFINER + `has_any_role('admin','manager','therapist')` check. Customer name resolved via `members.first_name + last_name` → fallback `non_member_profiles` → "Walk-in".

**New files**
- `src/components/admin/spa/SpaPayrollTab.tsx` — therapist selector, date range, editable preview table, "Generate PDF" button
- `src/lib/spaPayrollPdf.ts` — builds PDF using `jsPDF` + `jspdf-autotable` (already used elsewhere in project; verify and add if missing). Layout matches the reference: blue header rows (#2F75A6), gray cash-tips header (#8C8C8C), light-blue total row (#D6EAF8), italic footnote on cash tips.
- `src/hooks/useTherapistPayroll.ts` — fetches RPC result, exposes editable state

**Edits**
- `src/pages/admin/SpaManagement.tsx` — add "Payroll" tab
- `src/components/admin/spa/SpaTherapistsTab.tsx` — add hourly rate field to add/edit dialog
- `src/hooks/useSpaManagement.ts` — extend `SpaTherapist` type with `hourly_rate`

### Out of scope

- No automatic payroll dispatch / Stripe payout — this is a download-only tool
- No historical pay-period storage (each generation is on-demand from appointment data)
- Tip rounding/splitting between staff is not handled (single-therapist appts only, which is the current spa model)
