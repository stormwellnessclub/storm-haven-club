

## Fix Check-In System: Scanner Speed, Data Consistency, and Health Score Integration

### Problems Identified

1. **Scanner fires too fast (no debounce)**: The camera scanner (`MemberCameraScanner`) calls `onScanSuccess` on every decoded frame with zero cooldown. The `handleCameraScan` in `Scanner.tsx` has no guard either -- it calls `processScan` immediately every time. This creates dozens of simultaneous RPC calls.

2. **Check-ins not appearing in the list**: The CheckIn page (`/admin/check-in`) fetches recent check-ins only on mount (`useEffect([], [])`). It never refetches after a scan from the Scanner page (`/admin/scanner`). These are two separate pages with independent state. The Scanner page uses `useMemberScanner` hook which inserts check-ins via the `process_member_scan` RPC, but the CheckIn page's `fetchRecentCheckIns` is never called after those inserts.

3. **Health score ignores check-ins**: The `calculate_health_score` database function only counts `workout_logs` -- it completely ignores the `check_ins` table. The `useHealthScore` hook returns hardcoded zeros for `activity_counts.check_ins`. Members never see their check-in activity reflected in their health score.

### Solution

#### 1. Add scan cooldown/debounce to camera scanner

In `MemberCameraScanner.tsx`, add a ref-based cooldown (3 seconds) so that after a successful scan decode, subsequent decodes of the same or any QR code are ignored for a configurable period.

In `Scanner.tsx`, add a `useRef` processing guard to `processScan` so even if two scan events slip through, only one RPC call is made at a time.

#### 2. Make CheckIn page data reactive

- Add a polling interval (every 15 seconds) to `fetchRecentCheckIns` and `fetchTodayStats` in `CheckIn.tsx` so the list stays current even when check-ins come from the Scanner page or the database function.
- Alternatively, convert to `useQuery` with `refetchInterval` for consistency with the rest of the app.

#### 3. Include check-ins in health score calculation

Update the `calculate_health_score` database function to also count rows from the `check_ins` table in the last 30 days, adding points for check-in frequency (e.g., each check-in worth 2 points, capped at 20).

Update the `useHealthScore` hook to also fetch the actual `check_ins` count and populate `activity_counts.check_ins` with real data instead of hardcoded zero.

---

### Technical Details

#### File: `src/components/admin/MemberCameraScanner.tsx`

Add a cooldown ref to prevent rapid-fire scans:

```typescript
const lastScanTimeRef = useRef<number>(0);
const SCAN_COOLDOWN_MS = 3000; // 3-second cooldown between scans

// In the Html5Qrcode start callback:
(decodedText) => {
  const now = Date.now();
  if (now - lastScanTimeRef.current < SCAN_COOLDOWN_MS) return;
  lastScanTimeRef.current = now;
  onScanSuccess(decodedText);
}
```

#### File: `src/pages/admin/Scanner.tsx`

Add a ref guard to `processScan`:

```typescript
const isProcessingRef = useRef(false);

const processScan = async (memberId: string, deviceType: DeviceType) => {
  if (isProcessingRef.current) return;
  isProcessingRef.current = true;
  try {
    // ...existing scan logic...
  } finally {
    // Reset after cooldown
    setTimeout(() => { isProcessingRef.current = false; }, 2000);
  }
};
```

#### File: `src/pages/admin/CheckIn.tsx`

Convert `fetchRecentCheckIns` and `fetchTodayStats` to poll every 15 seconds:

```typescript
useEffect(() => {
  fetchRecentCheckIns();
  fetchTodayStats();
  const interval = setInterval(() => {
    fetchRecentCheckIns();
    fetchTodayStats();
  }, 15000);
  return () => clearInterval(interval);
}, []);
```

#### Database Migration: Update `calculate_health_score`

```sql
CREATE OR REPLACE FUNCTION public.calculate_health_score(_member_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_score integer := 50;
  v_workout_count integer;
  v_checkin_count integer;
BEGIN
  -- Workouts in last 30 days
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs
  WHERE member_id = _member_id AND logged_at > now() - interval '30 days';
  v_score := v_score + LEAST(v_workout_count * 3, 30);

  -- Check-ins in last 30 days (NEW)
  SELECT COUNT(*) INTO v_checkin_count FROM check_ins
  WHERE member_id = _member_id AND checked_in_at > now() - interval '30 days';
  v_score := v_score + LEAST(v_checkin_count * 2, 20);

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$;
```

#### File: `src/hooks/useHealthScore.ts`

After calling the RPC, also fetch actual check-in count to populate `activity_counts`:

```typescript
// Fetch actual check-in count
const { count: checkInCount } = await supabase
  .from("check_ins")
  .select("*", { count: "exact", head: true })
  .eq("member_id", targetMemberId)
  .gte("checked_in_at", new Date(Date.now() - (periodDays || 30) * 86400000).toISOString());

// Then in the return object:
activity_counts: {
  classes: 0,
  spa_services: 0,
  workouts: 0,
  check_ins: checkInCount || 0,
  unique_days: 0,
}
```

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/admin/MemberCameraScanner.tsx` | Add 3-second cooldown between scan callbacks |
| `src/pages/admin/Scanner.tsx` | Add ref guard to prevent concurrent scan processing |
| `src/pages/admin/CheckIn.tsx` | Add 15-second polling interval for recent check-ins and stats |
| `src/hooks/useHealthScore.ts` | Fetch real check-in count for activity_counts |
| Database migration | Update `calculate_health_score` to include check-ins |

