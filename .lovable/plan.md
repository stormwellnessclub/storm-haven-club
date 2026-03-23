

# Class Schedule & Booking System — Full Audit

## Critical Bugs

### 1. Double Enrollment Increment (HIGH)
The `create_atomic_class_booking` RPC manually runs `UPDATE class_sessions SET current_enrollment = current_enrollment + 1` after inserting a booking. But a trigger `update_enrollment_on_booking` also fires on `INSERT` to `class_bookings` and increments enrollment. **Result: every booking increments enrollment by 2**, making classes appear full at half capacity.

**Fix**: Remove the manual `UPDATE class_sessions SET current_enrollment = current_enrollment + 1` from the `create_atomic_class_booking` function, since the trigger already handles it. Then run a one-time recalculation migration to fix all existing session counts.

### 2. Admin Cancel RPC Parameter Mismatch (HIGH)
In `src/pages/admin/Classes.tsx` line 177, the admin cancel call passes `_reason` as the parameter name:
```typescript
supabase.rpc('admin_cancel_class_session', {
  _session_id: selectedSession.id,
  _reason: cancellationReason || 'Class cancelled by admin',
});
```
But the actual function signature expects `_cancellation_reason` (confirmed in types.ts). **Result: the cancellation reason is silently ignored** — every admin cancellation stores a NULL reason.

**Fix**: Change `_reason` to `_cancellation_reason` in the RPC call.

---

## Logic Gaps

### 3. No Cron Jobs Scheduled for Edge Functions
The following edge functions exist but have **no cron jobs set up** to call them automatically:
- `process-session-generation` — should run weekly to generate upcoming sessions
- `send-class-reminders` — should run hourly to send reminders before class
- `process-expired-waitlist` — should run every 15-30 min to expire unclaimed waitlist spots
- `notify-waitlist` — called by other functions, but `process-expired-waitlist` (which calls it) has no cron

**Fix**: Create `pg_cron` + `pg_net` scheduled jobs for each function at appropriate intervals.

### 4. Public Schedule Page Has No Booking Capability
The `/schedule` page (the live weekly timetable with times) is **read-only** — no booking buttons, no login prompt, no link to book. Users can see classes but cannot act on them. The `ClassCalendar` + `ClassCard` + `BookingModal` components exist and are fully functional but are **not used on any page**.

**Fix**: Either integrate the booking components into `/schedule`, or add clear CTAs directing logged-in users to the member booking flow.

### 5. No "Pilates & Cycling" Category Filter on Public Schedule
The `Schedule.tsx` category filters include Reformer, Cycling, and Aerobics — but all classes are stored with category `pilates_cycling` or `other` in the database. **The Reformer and Cycling filters will never match any sessions** because the DB doesn't use those category values.

**Fix**: Update the filter buttons to match actual DB categories (`pilates_cycling` and `other`), or map the filters to the correct DB values.

### 6. `cancel_class_booking` Doesn't Notify Waitlist
The member-facing `cancel_class_booking` RPC cancels the booking and restores credits, but does NOT notify the next person on the waitlist. The client-side code in `useBooking.ts` calls `notify-waitlist` after the RPC returns — but if the edge function call fails (network issue, etc.), the waitlist person is never notified and the spot goes unfilled.

**Fix**: Either move waitlist notification into the RPC itself (call `pg_net` to invoke the edge function), or add a periodic cron that checks for sessions with waitlist entries and available spots.

### 7. `useClassSessions` Hook Filters by Legacy Categories
The `useClassSessions` hook accepts `"reformer" | "cycling" | "aerobics"` as category filters, but the database only has `pilates_cycling` and `other`. This hook is used by `ClassCalendar`/`ClassCard` components. If someone passes `category: "reformer"`, the `!inner` join on `class_types` with `.eq("class_types.category", "reformer")` will return zero results.

---

## Edge Cases & Reliability

### 8. No Duplicate Booking Prevention at Schedule Page Level
The public `/schedule` page has no awareness of whether a user is already booked for a session. The DB `create_atomic_class_booking` RPC checks for duplicates, but the user gets no UI indication they're already booked until they try and get an error.

### 9. Late Cancellation Time Calculation Is Timezone-Naive
In `cancel_class_booking` RPC (line 49):
```sql
_session_datetime := (_session.session_date || 'T' || _session.start_time)::timestamptz;
```
This casts without an explicit timezone. If the DB timezone differs from the club's local timezone, the 24-hour policy cutoff will be wrong — potentially forfeiting credits incorrectly or allowing late free cancellations.

**Fix**: Use an explicit timezone cast, e.g., `AT TIME ZONE 'America/Chicago'`.

### 10. Booking Interface Category Type Mismatch
The `Booking` interface in `useBooking.ts` (line 29) has `category: "reformer" | "cycling" | "aerobics"` but the database only stores `pilates_cycling` and `other`. This means bookings for actual classes won't match these types, potentially causing display issues.

### 11. `is_hidden` Column Not in `useClassSessions` Hook Query
The public `Schedule.tsx` correctly filters `.eq("is_hidden", false)`, but the `useClassSessions` hook (used by booking components) does NOT filter by `is_hidden`. Hidden sessions could appear in booking flows.

---

## Summary of Fixes (Priority Order)

| # | Issue | Severity | Fix Type |
|---|-------|----------|----------|
| 1 | Double enrollment increment | Critical | DB migration |
| 2 | Admin cancel parameter mismatch | High | Code fix |
| 3 | No cron jobs for edge functions | High | DB insert (pg_cron) |
| 4 | Schedule page has no booking | Medium | UI integration |
| 5 | Category filter mismatch | Medium | Code fix |
| 6 | Waitlist notification reliability | Medium | Architecture |
| 7 | useClassSessions legacy categories | Medium | Code fix |
| 8 | No booked-state on schedule | Low | UI enhancement |
| 9 | Timezone-naive cancellation | Low | DB migration |
| 10 | Booking type mismatch | Low | Code fix |
| 11 | is_hidden not filtered in hook | Low | Code fix |

Approve this plan to begin fixing these issues in priority order.

