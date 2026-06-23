Lock down the three security warnings flagged on the project. None are critical (publish isn't blocked), but they're all worth fixing properly.

## 1. `instructors` — hide `email` / `phone` from the API

Today there's a SELECT policy for `authenticated`, but no column-level GRANTs constraining it. Staff already read contact info via the existing `get_instructors_with_contact()` SECURITY DEFINER RPC, so the table itself never needs to expose `email`/`phone`.

Migration:
- `REVOKE SELECT ON public.instructors FROM anon, authenticated;`
- `GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, user_id, created_at, updated_at) ON public.instructors TO authenticated;`
- Leave INSERT/UPDATE/DELETE to `service_role` (admin code paths already use RPCs / service role).

Result: even if a future RLS policy is too permissive, PostgREST cannot return `email` or `phone` to anon/authenticated.

## 2. `spa_therapists` — hide `email`, `phone`, `hourly_rate`

Same shape: anon and authenticated SELECT policies, no column GRANTs. `useAllAppointmentHistory` only reads `id, first_name, last_name`; admin writes go through `useSpaManagement` under admin role.

Migration:
- `REVOKE SELECT ON public.spa_therapists FROM anon, authenticated;`
- `GRANT SELECT (id, full_name, bio, photo_url, specialties, is_active, created_at, updated_at) ON public.spa_therapists TO anon, authenticated;`
- Keep `email`, `phone`, `hourly_rate` reachable only via `service_role` / admin RPCs.

If anywhere in admin code still does `select('*')` on `spa_therapists` from the client, switch it to an explicit column list or a SECURITY DEFINER RPC gated by `has_any_role('admin','super_admin','staff')`.

## 3. `scheduled_functions_config` — stop storing the anon key in the DB

The row holds the project URL and anon key. The table is locked (`USING false`), but storing the anon key in a table at all is unnecessary risk. The anon key is already a public token shipped to browsers, so the real fix is to stop persisting it server-side.

Migration:
- `ALTER TABLE public.scheduled_functions_config DROP COLUMN anon_key;`
- `ALTER TABLE public.scheduled_functions_config DROP COLUMN supabase_url;` (project ref is fixed; URL can be derived from `VITE_SUPABASE_URL` or inlined in the edge function).
- Update any pg_cron job / edge function that reads from this table to use the built-in `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars in the edge function instead. I'll grep for usages before the migration and patch them in the same change set.

After the migration, mark all three findings as fixed in the security memory with the rationale above (column GRANTs are the durable defense; anon key removed from DB).

## What I will NOT change
- The existing `get_instructors_with_contact()` RPC and admin flows — they keep working.
- Public-facing fields (name, bio, photo, specialties) stay readable so the website still renders therapist/instructor cards.
- No business logic, no UI changes.