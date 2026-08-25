# Fix: Spa page won't let you add a new therapist

## What's happening

The therapist list on the Spa admin page loads fine, but adding, editing, or deleting a therapist fails. The list is read through a special server function that bypasses table permissions, while add/edit/delete write straight to the therapists table — and that table currently has no access granted to signed-in users at all.

This was a side effect of an earlier security cleanup: access to the therapists table was revoked to stop the public from reading therapist contact details and pay rates. The revoke went one step too far and also removed staff write access. Verified: the therapists table has permissions only for the system role, while every other spa table (services, rooms, availability, assignments) still has normal access.

## The fix

1. Restore access to the therapists table for signed-in users only — public/anonymous access stays revoked, so contact info and hourly rates remain hidden from the website.
2. Row-level rules already limit who can act: only super admin, admin, manager, and spa staff can add, edit, or delete a therapist; front desk can view.
3. Confirm afterwards by adding a test therapist from the Spa page and removing it.

## Technical notes

- `public.spa_therapists` has `relacl` entries for `postgres`/`service_role` only; `authenticated` and `anon` were revoked.
- Migration: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_therapists TO authenticated;` and `GRANT ALL ON public.spa_therapists TO service_role;` — no grant to `anon`.
- Existing policies stay unchanged: "Staff can manage spa therapists" (ALL, staff roles) and "Staff can view spa therapists" (SELECT, staff + front_desk).
- Public-facing pages keep using `get_public_spa_therapists`; admin list keeps using `get_spa_therapists_with_contact`.
- No frontend changes needed; `useSpaManagement.ts` mutations already target the table directly.
