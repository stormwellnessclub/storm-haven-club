

# Fix: Guest check-ins not counted in front desk attendance

## Problem

The attendance feed on the front desk (`kiosk_todays_attendance`) filters guest passes by `valid_date = today`. But when a guest pass is created with a future or past `valid_date` — or when the guest simply shows up on a different day than the pass date — checking them in sets `used_at = now()` but does NOT update `valid_date` to today. So the attendance query misses them entirely.

Additionally, the guest search (`kiosk_search_visitors`) also filters by `valid_date = today`, meaning guests with passes for other dates can't even be found to check in.

## Root cause

In `kiosk_check_in_guest`, line 348-349:
```sql
UPDATE public.guest_passes
SET status = 'used', used_at = now()
WHERE id = p_guest_pass_id;
```
It never sets `valid_date = current_date`.

And `kiosk_todays_attendance` line 256:
```sql
WHERE valid_date = v_today AND status = 'used' AND used_at IS NOT NULL
```
This misses any guest pass whose `valid_date` doesn't match today.

## Fix (database migration)

1. **Update `kiosk_check_in_guest`** — also set `valid_date = current_date` when marking a pass as used, so the attendance query picks it up:
```sql
UPDATE public.guest_passes
SET status = 'used', used_at = now(), valid_date = current_date
WHERE id = p_guest_pass_id;
```

2. **Update `kiosk_todays_attendance`** guest query — use `used_at >= today_start` as the primary filter instead of relying solely on `valid_date`, so any guest checked in today appears regardless of original valid_date:
```sql
WHERE status = 'used' AND used_at >= v_today_start
```

3. **Update `kiosk_search_visitors`** guest search — broaden to also show passes with future valid_dates or no valid_date, so staff can check in a guest who shows up on an unexpected day:
```sql
WHERE status IN ('active', 'purchased')
  AND (valid_date IS NULL OR valid_date >= v_today)
```

## Files changed
- One database migration (SQL only, no frontend changes needed)

