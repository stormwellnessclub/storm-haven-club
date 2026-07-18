## Likely cause

Cafe image uploads go to the `cafe-menu-images` storage bucket. The RLS policies on `storage.objects` for that bucket (migration `20260503043627`) only allow these roles to INSERT/UPDATE/DELETE:

- `super_admin`
- `admin`
- `manager`
- `cafe_staff`

Any other staff role (e.g. `front_desk`, `staff`, `kiosk`, an instructor, or an unauthenticated kiosk session) is rejected by RLS, and the Supabase client surfaces it as a generic "new row violates row-level security policy" / "Upload failed" toast in `CafeMenuManager` / `useCafeMenu.uploadCafeMenuImage`.

Secondary contributor: the upload uses `{ upsert: true }`, which requires both INSERT **and** UPDATE policies to pass — so a role missing from either policy fails silently on retry.

## To confirm before fixing

1. Reproduce the upload and capture the exact error text (console + network 4xx body from `/storage/v1/object/cafe-menu-images/...`).
2. Check which account is uploading and what roles it has in `user_roles`. If the user role is not in the allow-list above, that's the failure.
3. If the error is instead `413`/`payload too large` or a MIME rejection, the cause is different (bucket size/mime limit) and we'll adjust accordingly.

## Fix (pending confirmation)

Depending on what step 2 shows, one of:

- **A. Role gap (most likely):** add the missing role(s) to the three `cafe-menu-images` storage policies — typically extending the allow-list to include `front_desk` / `staff` if the person managing the menu isn't a cafe_staff/admin.
- **B. Correct user, wrong role assignment:** grant the uploading user the `cafe_staff` role in `user_roles` instead of widening the policy.
- **C. Non-RLS error (size/mime/network):** adjust bucket limits or the client-side validation in `CafeMenuManager` accordingly.

No code changes yet — I'd like the exact error message and the uploading account so we pick the right fix and don't over-widen storage write access.

### Technical notes

- Bucket policies live in `supabase/migrations/20260503043627_e6da1c41-7c4f-478b-9971-ec9b2ce470ca.sql`.
- Upload code: `uploadCafeMenuImage` in `src/hooks/useCafeMenu.ts` (line 274).
- Any policy change must cover INSERT and UPDATE (because of `upsert: true`); DELETE only needed for the image-review page.
