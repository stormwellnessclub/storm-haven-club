

## Fix: Nada's Missing Non-Member Profile + Admin Access to All Accounts

### Problems Found

1. **Nada Almadhagi (nadaalma1125@gmail.com, user_id: b6b61e33-...)** has no row in `non_member_profiles`. She has an active class pass (1 class, expires Mar 21) but is invisible in admin Non-Member Accounts and may have issues in the portal.

2. **Her `profiles` row has `last_name: "Alma"`** instead of "Almadhagi" — likely truncated during signup.

3. **Admin Non-Member Accounts page only shows users who have a `non_member_profiles` row.** Anyone who purchased a pass but whose auto-create failed won't appear.

### Plan

#### A. Data fix (SQL migration)
- Insert a `non_member_profiles` row for Nada, pulling data from her `profiles` row
- Update her last name to "Almadhagi" in both `profiles` and the new `non_member_profiles` row

```sql
INSERT INTO non_member_profiles (user_id, email, first_name, last_name, phone)
VALUES ('b6b61e33-02b4-4aa4-a579-c5a9dcab6069', 'nadaalma1125@gmail.com', 'Nada', 'Almadhagi', null)
ON CONFLICT (user_id) DO UPDATE SET first_name = 'Nada', last_name = 'Almadhagi';

UPDATE profiles SET last_name = 'Almadhagi' WHERE user_id = 'b6b61e33-02b4-4aa4-a579-c5a9dcab6069';
```

#### B. Safety net: auto-create missing non_member_profiles for any user with class passes
- Add a second query in the admin Non-Member Accounts page that finds users who have `class_passes` but no `non_member_profiles` row, and auto-creates the missing rows
- OR: modify the admin query to also include users from `class_passes` who lack a `non_member_profiles` entry, joining with `profiles` for name/email

#### C. File changes
- **`src/pages/admin/NonMemberAccounts.tsx`** — Update the query to also discover users who have class passes but no `non_member_profiles` row (join `class_passes` → `profiles` to fill in names)
- **New SQL migration** — Insert Nada's missing row and fix her last name

