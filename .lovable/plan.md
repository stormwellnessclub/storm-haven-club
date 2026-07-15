# Switch club timezone to America/Detroit (Eastern)

## Context

You've clarified the club operates on Michigan Eastern time, not Central. Right now the codebase treats `America/Chicago` as the authoritative timezone in many places (see `src/lib/clubTime.ts`, `send-class-reminders`, `send-spa-reminders`, and numerous RPCs/edge functions). This is also the root cause of the "class shows the day before" bug in booking confirmations — a Wednesday 12:00 AM–4:00 AM ET class formatted in Chicago rolls back to Tuesday.

## Scope of this plan

Two coordinated changes:

### 1. Fix the booking confirmation off-by-one (immediate bug)

In `src/hooks/useBooking.ts`, format `session_date` as a local calendar date (parse `YYYY-MM-DD` into a local Date using `new Date(y, m-1, d)`) instead of `parseISO`, so it never shifts across a timezone boundary. Apply the same fix to any other confirmation/cancellation trigger that formats `session_date` (send-email templates, send-sms callers).

### 2. Migrate club timezone constant to `America/Detroit`

Frontend:
- `src/lib/clubTime.ts` — change `CLUB_TZ` to `America/Detroit`. All helpers (`clubTodayDateStr`, `clubTodayStart`, `hasSessionEnded`, etc.) automatically follow.
- Grep for hardcoded `"America/Chicago"` in `src/` and replace with the `CLUB_TZ` constant or `America/Detroit`. Known hits include schedule/booking components, spa time utils, PT format, and various admin pages.

Edge functions (Deno):
- `send-class-reminders`, `send-spa-reminders`, and any other function referencing `America/Chicago` — swap to `America/Detroit`.
- Reminder windows continue to work because they use offsets from `now`; only the date-label formatting changes.

Database:
- Search migrations/RPCs for `'America/Chicago'` (e.g. session generation, credit expiry at 23:59:59, cron helpers). Add a migration that updates each function/default to `'America/Detroit'`. Leave stored timestamps alone — only the interpretation constant changes.

Memory:
- Update `mem://index.md` Core rule and `mem://features/classes/timezone-policy` to say `America/Detroit`.

## Out of scope

- No changes to historical data. Existing `session_date` + `start_time` rows are Chicago wall-clock; after the switch they'll be read as Eastern wall-clock. If you want past sessions "shifted" rather than "reinterpreted," that's a separate data migration — please confirm before I do it.
- No UI redesign; only the tz constant and the date-parse fix.

## Verification

- Book a class dated Wednesday from a device set to Pacific time — confirmation email/SMS must say Wednesday.
- Kiosk "today's classes" at 11pm ET must still show today's date (not tomorrow's).
- Credit expiration timestamps for a member on a fresh cycle should land at 23:59:59 ET on the correct calendar date.

## Question before I execute

Do you want me to (a) reinterpret existing sessions as Eastern (simpler, means already-scheduled classes stay at the same wall-clock number like "7:00 PM" but that number is now ET), or (b) shift stored times by −1 hour so a session previously stored as 7:00 PM Central becomes 8:00 PM Eastern? Almost every club I've seen wants (a); confirm before I write the migration.
