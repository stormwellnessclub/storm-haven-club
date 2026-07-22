## Diagnosis (verified)

Public schedule fetch fails with HTTP 401:
`permission denied for table instructors` (code 42501).

Confirmed by hitting the Data API as `anon` with the exact query `ScheduleBrowser.tsx` runs, and by inspecting the catalog:

- `public.instructors` has **no `GRANT`s to any role** (`role_table_grants` returns 0 rows for it), so PostgREST rejects every read — including the embed used by `/schedule`.
- RLS policies exist for staff, but PostgREST checks grants **before** RLS.
- Data itself is fine: `class_sessions` has 158 upcoming visible rows.

An earlier tightening pass on the `instructors` table dropped all grants without restoring the public-safe subset needed by the schedule embed.

## Fix

One migration to restore correct grants + a public-read RLS policy limited to safe columns.

**Sensitive columns to keep private from `anon`:** `email`, `phone`, `pay_type`, `default_per_class_rate`, `hourly_rate`, `user_id`, `invited_at`, `last_login_at`, `portal_enabled`, `is_public_pt`.

**Public-safe columns for `anon`:** `id`, `first_name`, `last_name`, `bio`, `photo_url`, `specialties`, `is_active`, `is_master`, `created_at`, `updated_at`.

### Migration

```sql
-- 1. Restore table-level grants (were fully missing).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;

-- 2. Grant anon SELECT only on public-safe columns.
GRANT SELECT
  (id, first_name, last_name, bio, photo_url, specialties,
   is_active, is_master, created_at, updated_at)
  ON public.instructors TO anon;

-- 3. RLS policy so anon can read active instructors
--    (existing staff/authenticated policies remain unchanged).
CREATE POLICY "Public can view active instructors (safe cols)"
  ON public.instructors
  FOR SELECT
  TO anon
  USING (is_active = true);
```

No frontend changes needed — `ScheduleBrowser.tsx` already only selects the safe columns (`id, first_name, last_name, is_master`).

## Verification

After the migration:
1. Re-run the anon curl against `/rest/v1/class_sessions?...instructors(id,...)` — expect HTTP 200 with rows.
2. Load `/schedule` in the preview — sessions should render.
3. Confirm anon still cannot read `email`/`phone` (a query selecting those columns as anon should still return 42501).
