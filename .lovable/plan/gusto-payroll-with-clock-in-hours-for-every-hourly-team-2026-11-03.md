# Gusto payroll with clock-in hours for every hourly team

## How hours get tracked (the answer to your question)
Gusto doesn't track hours inside our building. It only pays whatever hours we send it. So the app has to collect hours, and it already partly does: front desk staff clock in and out at the front desk screen today. The plan is to give that same clock-in to every hourly team.

- **Front desk, cafe, kids care:** clock in and out with their staff PIN on the front desk/kiosk screen (or their phone, if signed in). A shift left open is closed automatically at closing time and flagged for a manager to check, the way front desk works now.
- **Spa therapists:** paid from completed appointments and tips we already record. No clock-in needed unless they also get hourly pay.
- **PT trainers:** paid from completed sessions, which the hourly job already marks.
- **Class instructors:** paid from the instructor pay periods that already exist (per class or hourly).

## Pay period review (manager screen)
- One "Payroll" page lists each person for the pay period: hours (regular and overtime over 40 a week), services, sessions, classes and tips, with each item linked back to its record.
- Managers can fix a missed clock-out or wrong time. Every change is logged with who made it and why.
- Nothing goes to Gusto until a manager clicks Approve.

## Sending to Gusto
- After approval, one click sends hours, commissions/service pay and tips to the matching Gusto payroll as a draft. You still review it and submit in Gusto, and Gusto handles the paying, taxes and filing.
- Staff are matched to Gusto employees once, on a setup screen.
- A pay period can only be sent once. Sending it again updates the same draft and never makes a second payroll.
- A CSV download is always there as a backup.

## What I need from you
- A Gusto account. Connecting it needs a Gusto developer app (I'll guide you through it). If that slows us down, we start with the CSV upload.
- Pay rates and pay type for each person: hourly, per service, commission %, or per class.
- Your pay schedule (weekly or every two weeks) and the day it starts.

## Testing
- Tests run against a Gusto demo account and sample staff only. No real payroll gets created and no real person's pay changes.

## Technical details
- Expand `staff_shift_clocks` to all hourly roles (cafe_staff, childcare_staff, front_desk) through the existing PIN kiosk RPCs; add a role/department column and an audit table for edits.
- New tables: `payroll_periods`, `payroll_lines` (source type + source id, for traceability), `payroll_staff_links` (user to Gusto employee id), `staff_pay_rates`.
- Pay amounts come from completed spa appointments, `pt_appointments` (completed), `instructor_pay_items`, and clock rows, all on Detroit days.
- Edge function `gusto-payroll` (Gusto OAuth, tokens kept on the server): sync employees, then PUT to the unprocessed payroll's employee compensations using a stored payroll version, idempotent per period.
- Admin-only access through user_roles. Record the decision in AGENTS.md.
