## Two issues, both confirmed in code/data

### 1. "Unknown" non-members in class roster

The `kiosk_class_roster` RPC only resolves names from `members.first_name + last_name` or `class_bookings.walk_in_name`. Non-member bookings have `member_id = NULL` and an empty `walk_in_name` — their identity lives in the `profiles` table keyed by `user_id`. Verified live: e.g. booking by user `6f02a967…` is "Samar Hannawi / shannawi@outlook.com" in `profiles`, but the RPC returns `Unknown`.

**Fix:** Extend the RPC's `COALESCE` chain to fall back to `profiles` (joined on `user_id`), then `non_member_profiles` (also on `user_id`), then `walk_in_name`, then a synthesized "Guest – {email}" if we only have an email, then `Unknown` as a true last resort.

```sql
COALESCE(
  NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''),
  NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
  NULLIF(TRIM(nmp.first_name || ' ' || nmp.last_name), ''),
  NULLIF(cb.walk_in_name, ''),
  CASE WHEN cb.walk_in_email IS NOT NULL THEN 'Guest – ' || cb.walk_in_email
       WHEN p.email IS NOT NULL THEN 'Guest – ' || p.email
       ELSO 'Unknown' END
)
```

Also widen `photo_url` to fall back to the profile's `avatar_url` when there's no member record. Re-grant EXECUTE to `anon` and `authenticated`.

### 2. Military time on the kiosk class lists

Two spots in `src/pages/FrontDesk.tsx` use `s.start_time?.slice(0, 5)` which renders `"14:30"`:
- **Line 270** — Today's classes list
- **Line 361** — Bookings table

**Fix:** Use the existing `formatTime12h` helper from `src/lib/timeFormat.ts` so they render `"2:30 PM"` instead.

## Technical details

- New migration: `CREATE OR REPLACE FUNCTION public.kiosk_class_roster(uuid)` with the expanded `COALESCE` and the `LEFT JOIN profiles p ON p.user_id = cb.user_id` + `LEFT JOIN non_member_profiles nmp ON nmp.user_id = cb.user_id`. Re-grants execute to `anon` + `authenticated`. `SECURITY DEFINER` stays — kiosk runs anonymously.
- Edit `src/pages/FrontDesk.tsx` lines 270 and 361 to use `formatTime12h(s.start_time)` / `formatTime12h(b.start_time)` and add the import.
- No frontend changes needed for issue #1 — the roster component already renders whatever name the RPC returns.