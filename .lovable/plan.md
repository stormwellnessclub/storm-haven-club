
We need to fix this at the data-model and workflow level, not just the roster label.

What I found
- The roster still does not guarantee a complete person record for every booking.
- `ClassRoster.tsx` only enriches missing bookings from `profiles`, not from `non_member_profiles`, and it does not surface phone numbers in the roster table.
- `Classes.tsx` attendee previews also only fall back to `profiles`, so non-members can still appear as partial or missing identities.
- `PersonSearch.tsx` returns only name/email/type/passCount. It does not include phone, so staff cannot verify or select people with full contact context.
- Walk-ins/new people can be added to class with `walk_in_name`, optional email, optional phone, but that phone is not persisted anywhere. So the system literally loses the contact info.
- `non_member_profiles` requires `user_id`, which means you cannot create a proper non-member profile for a true walk-in who has no account yet. That is the core structural gap.
- There is already a partial pre-registration system (`pending_non_member_imports`) with name/email/phone, but class-roster walk-ins do not use it.

What to build
1. Make “every booked person has a real contact record” the rule
- Treat bare `walk_in_name` bookings as insufficient.
- For any non-member/non-account attendee, store a real contact record with name, phone, and optionally email.
- Keep roster display resolution in this order:
  - member record
  - non-member profile
  - account profile
  - pending non-member contact
  - walk-in fallback only for legacy rows

2. Introduce a proper pre-account contact link for bookings
- Add a nullable `pending_import_id` (or equivalent contact reference) on `class_bookings`.
- Use it for people who do not yet have a user account.
- This avoids forcing fake users while still preserving full identity and phone number.

3. Upgrade class-roster add flow
- In `ClassRoster.tsx`, when staff adds a new non-member/walk-in:
  - require first name, last name, phone
  - email optional but recommended
  - if an existing member/account/non-member exists, reuse it
  - otherwise create or reuse a pending contact record and attach it to the booking
- If the person later creates an account, keep the booking link resolvable through the existing fulfillment flow.

4. Unify roster identity fetching everywhere
- Extract one shared roster identity query/helper used by:
  - `ClassRoster.tsx`
  - `Classes.tsx`
  - attendee previews / future admin roster surfaces
- It should fetch:
  - member name + phone
  - non-member profile name + phone
  - account profile name + phone
  - pending contact name + phone
  - legacy walk-in name
- This removes the current mismatch where one screen shows a count, another shows “Unknown”.

5. Surface phone numbers in the admin UI
- Add phone as a first-class field in:
  - roster table
  - attendee previews/details
  - person search results
  - add-to-class confirmation
- Staff should be able to immediately see who the person is and how to contact them.

6. Improve person search to return full contact context
- Extend `PersonSearch.tsx` to include phone and richer source resolution.
- Search members, non-member profiles, profiles, and pending non-member contacts.
- Deduplicate by actual identity source, not just `user_id`, so pre-account contacts are also selectable.

7. Backfill legacy bookings as much as possible
- For existing bookings with no member and no full profile:
  - match by `user_id` into `non_member_profiles` first, then `profiles`
  - where only `walk_in_name` exists, keep legacy fallback visible
- Do not hide those bookings; just make the new resolver expose the best available identity now.

8. Keep non-member profile data synchronized where accounts exist
- When a non-member has both `profiles` and `non_member_profiles`, keep name/phone aligned consistently.
- Expand the existing sync approach so updates don’t drift between tables.

Files likely involved
- `src/pages/admin/ClassRoster.tsx`
- `src/pages/admin/Classes.tsx`
- `src/components/admin/roster/PersonSearch.tsx`
- `src/pages/admin/People.tsx`
- `src/pages/admin/NonMemberAccounts.tsx`
- new shared admin roster/contact resolver hook/helper
- migration(s) for booking contact linkage and contact backfill support
- possibly existing pending import / non-member sync functions

Technical notes
- The structural problem is that `class_bookings.user_id` was made nullable for walk-ins, but there is no equivalent first-class contact table reference on the booking.
- `walk_in_name` alone is not enough for business operations.
- The clean fix is to let bookings reference either:
  - a real account (`user_id`)
  - or a stored pre-account contact record
- This preserves RLS and avoids unsafe fake user/account workarounds.

Result
- Every attendee in class management will have a visible name and phone number.
- Non-members will no longer disappear behind “Unknown” or incomplete profile fallbacks.
- Staff can add and manage real non-member contacts from the roster without losing phone data.
- The system will finally treat members and non-members as full people records instead of second-class bookings.
