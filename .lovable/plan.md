# Instructor Class Pay Tracking (starting with Bea)

Give instructors a real "Hours & Pay" section in their portal, backed by per-class pay records, pay periods, and paid/unpaid status that admin controls.

## Pay rules

- Bea's rate: $40 per class taught.
- Only classes with at least one attending (checked-in) person are paid. Classes that ran empty are listed for reference at $0.
- Cancelled classes are never paid.

## Pay periods

- Two-week periods. The period 8/15/26 - 9/6/26 is recorded and marked **Paid** (the sheet we just produced).
- Next period: **9/7/26 - 9/20/26**, open and showing as due at period end.
- Periods can roll forward automatically every two weeks, and admin can also create or adjust a period manually.

## What Bea sees at /instructor/pay

- Current period card: date range, classes taught, attended classes, amount earned so far, status (Open / Due / Paid).
- Class-by-class list: date, time, class name, attendance count, rate, pay amount, and whether it's in a paid period.
- History of past periods with totals and paid dates, plus a downloadable one-page statement matching the PDF style already used.

## What admin gets

- On the instructor record: pay type and rate (set Bea to per-class $40).
- A pay period view listing each instructor's current period, computed total, and a "Mark paid" action that stamps the paid date and locks the period.
- Ability to adjust a single class's pay amount (with a note) for exceptions, and to add a manual line item (bonus, sub coverage).

## Data and technical notes

- New tables: `instructor_pay_periods` (instructor, start/end date, status open/due/paid, paid_at, paid_by, total) and `instructor_pay_items` (period, class_session reference or manual, date, description, attendance count, rate, amount, adjusted_by/notes). Both with grants, RLS: instructor reads own rows, admin/manager full access.
- Pay items are generated from `class_sessions` + `class_bookings` (attendance = bookings with `checked_in_at` and status not cancelled), using `America/Detroit` dates.
- A generation routine (RPC) fills or refreshes items for an open period; paid periods are frozen and never regenerated.
- Backfill: create the 8/15 - 9/6 period for Bea from the verified attendance data (8 classes with attendance, 15 attendances) and mark it paid; create the open 9/7 - 9/20 period.
- Set `instructors.pay_type = per_class`, `default_per_class_rate = 40` for Bea.
- Replace the `InstructorPay` stub in `src/pages/instructor/Stubs.tsx` with a real page; add the admin pay period screen under the existing instructors area.
- A low-frequency daily job closes an ended period (marks it Due) and opens the next two-week period.

## Not in this plan

The broader staff scheduling portal (front desk, childcare, cafe, mixed roles) is planned separately after this ships.
