

## Issue: Check-in counts differ across laptops & front desk

### Root cause: timezone mismatch between counting surfaces

Three different surfaces count "today's check-ins" using three different definitions of "today":

| Surface | Code | "Today" boundary used |
|---|---|---|
| Front Desk Kiosk (`/front-desk`) | RPC `kiosk_todays_attendance` → `date_trunc('day', now())` | **UTC midnight** |
| Admin Dashboard (`/admin`) | `new Date(y, m, d).toISOString()` | **Browser's local midnight** (varies per laptop) |
| Unified Attendance widget | Same browser-local logic | Browser's local midnight |

Per project policy, the authoritative timezone is **America/Chicago** — but neither path uses it. This causes the symptoms you're seeing:

- A check-in at **8:00 PM Chicago time Monday** = 01:00 UTC Tuesday. The kiosk (UTC) puts it in Tuesday's bucket. A Chicago laptop puts it in Monday. A Pacific laptop puts it in Monday. An Eastern laptop puts it in Tuesday.
- Late-night and early-morning check-ins shift between buckets depending on which device you open
- Two devices in different timezones will literally never agree on the count

There is also a related second issue: **`stats.currently_in`** counts everyone with `checked_out_at IS NULL` since "today" — but check-outs are rarely recorded, so this number drifts upward over time and isn't a real "in the building right now" figure. (Worth fixing while we're in here, but separate from the count-disagreement complaint.)

### Fix

Make every surface use the **America/Chicago day boundary** (the project standard) so all devices see the same number.

**1. Update the kiosk RPC `kiosk_todays_attendance`** — replace `date_trunc('day', now())` with the Chicago-day equivalent:
```sql
v_today_start := date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago';
v_today_end   := v_today_start + interval '1 day';
```
And add `< v_today_end` bounds to all four loops + the `currently_in` query so we don't accidentally include yesterday/tomorrow at boundary edges.

**2. Update browser-side counters** to use Chicago time instead of local time. Three call sites:
- `src/pages/admin/Dashboard.tsx` (lines 58–82) — the `todayCheckins`, `todayAppointments`, `todayClasses` query
- `src/hooks/useUnifiedAttendance.ts` (lines 32–82) — the parallel fetches
- `src/pages/admin/CheckIn.tsx` (~line 100) — "Check-ins This Month" counter

Add a small helper `src/lib/clubTime.ts` exporting:
- `clubTodayStart()` → ISO string of Chicago midnight today, in UTC
- `clubTodayEnd()` → next day's Chicago midnight, in UTC
- `clubTodayDateStr()` → `YYYY-MM-DD` in Chicago tz

Then every surface uses the same helpers.

**3. (Recommended) Tighten `currently_in`** so it only counts members whose `checked_out_at IS NULL` AND who checked in within the last ~6 hours, OR auto-expire stale check-ins via a cron. Even simpler: relabel that stat as "Members Checked In Today (Not Checked Out)" so users don't expect it to be a real-time occupancy. Pick one — I'll default to the relabel + 12-hour cutoff unless you say otherwise.

**4. Realtime sync (bonus polish)** — kiosk and admin dashboards currently poll every 15s and 60s respectively, so two devices can disagree by up to a minute even after the timezone fix. Subscribe to `postgres_changes` on `check_ins` so all open surfaces invalidate their query the moment a new check-in lands. Small change, makes the "why is mine different" complaint disappear entirely.

### Files to change

- **New**: `src/lib/clubTime.ts` (Chicago-tz helpers)
- **Modified**:
  - `src/pages/admin/Dashboard.tsx` — use `clubTodayStart/End`
  - `src/hooks/useUnifiedAttendance.ts` — same
  - `src/pages/admin/CheckIn.tsx` — same for monthly counter (use Chicago start-of-month)
  - `src/hooks/useKioskAttendance.ts` — add realtime subscription on `check_ins`
- **Migration**: rewrite `kiosk_todays_attendance()` to use America/Chicago bounds + add `< v_today_end` upper bound

### What you'll see after

- Open `/admin` on a Mac in California, a Windows laptop in Detroit, and the front desk iPad → all three show the **identical** "Today's Check-Ins" number
- The number flips to the next day at midnight **Chicago time** everywhere (not at UTC midnight, not at each laptop's local midnight)
- New check-ins appear on every open dashboard within ~1 second instead of up to a minute later

