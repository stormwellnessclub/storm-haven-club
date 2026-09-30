# Book Club: staff can add and remove people (including non-members)

## What you'll get
On **Events Portal → Higher Self Society** (Book Club Sign-ups):
- **Add person** button above the roster. It opens a panel right on the page (not a popup):
  - Search by name, email or phone. The search covers members, non-member accounts and other accounts.
  - Or type in a new person by hand: name, email, phone. They don't need an account.
  - Optional fields: preferred evening, themes, book suggestion and a staff note.
- Each roster row gets a **Remove** button. It asks you to confirm first. Removing takes the person off the list only. Their membership and account stay the same.
- Each row shows a small label: **Member**, **Non-member** or **Added by staff**.
- The spreadsheet download includes these labels.

Members keep signing up on the website as before. The public form stays members-only. Only staff can add non-members.

## Technical details
- Migration (additive):
  - `user_id` becomes nullable so staff-added guests without an account can be saved. The unique constraint stays, and Postgres allows more than one NULL.
  - New columns: `phone text`, `is_member boolean default true`, `added_by uuid`, `source text default 'self'` ('self' | 'staff'), `staff_note text`.
  - Unique index on `lower(email)` so nobody is added twice.
- SECURITY DEFINER RPCs, restricted to super_admin/admin/manager:
  - `admin_add_society_person(...)`: finds an active member by user_id or email and fills in their tier and founding flag; if none is found, saves them as a non-member. Cancelled members are refused.
  - `admin_remove_society_person(_id)`: deletes the row.
- Hooks: `useAdminAddSocietyPerson` and `useAdminRemoveSocietyPerson` in `useHigherSelfSociety.ts`.
- UI: an inline add panel in `EventsPortalSociety.tsx` that reuses `PersonSearch`, plus a Remove action with confirmation on each row.
- The invitation email list is unchanged: it still goes to active members only.
