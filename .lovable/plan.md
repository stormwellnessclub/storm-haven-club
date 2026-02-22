

## Adding 13 Non-Member Class Pass Holders

### Current Situation

| Status | People | Names |
|--------|--------|-------|
| Already have accounts + profiles | 3 | Nahla Hammoud, Souad Jomaa, Sindus Altalib |
| No account yet | 10 | Samar Salam, Bayan Mehanna, Nada Almadhagi, Randa Dirani, Reem Alhaddi, Salma Kazan, Summer Hamid, Yasmeena Serhane, Liana Dawoud, Samar Hannawi |

### The Challenge

Both the `non_member_profiles` and `class_passes` tables require a `user_id` (NOT NULL). The 10 new people don't have accounts yet, so we can't insert their records until they sign up.

### Step-by-Step Plan

**Step 1: Immediately add class passes for the 3 existing accounts**

Insert 10-class Pilates/Cycling passes for Nahla, Souad, and Sindus directly via SQL. They already have `user_id`s in the system.

| Name | Email | Pass Type |
|------|-------|-----------|
| Nahla Hammoud | nahlahammoud99@gmail.com | Pilates/Cycling 10-pack |
| Souad Jomaa | sjomaa11@gmail.com | Pilates/Cycling 10-pack |
| Sindus Altalib | smaltayib@yahoo.com | Pilates/Cycling 10-pack |

**Step 2: Build a "Bulk Pre-Register" admin tool**

Create a new component that lets you paste or enter multiple non-members at once. For each person, the system will:

1. Store a **pending registration record** in a new `pending_non_member_imports` table (name, email, phone, pass category, class count)
2. Send them the **activation email** automatically
3. When they sign up, a **database trigger** will automatically:
   - Create their `non_member_profile`
   - Create their `class_passes` record from the pending import
   - Mark the import as fulfilled

This way you don't have to manually go back and add passes after each person signs up.

**Step 3: Send activation emails**

The tool will send activation invite emails to all 10 people. When they click the link and create their account, the trigger handles everything.

### Database Changes

**New table: `pending_non_member_imports`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | Their email (unique, used for matching) |
| first_name | text | First name |
| last_name | text | Last name |
| phone | text | Phone number |
| pass_category | class_category | pilates_cycling, aerobics, other |
| pass_type | text | "10-pack" or "single" |
| classes_total | integer | Number of classes |
| expiration_days | integer | Days until expiry (default 90) |
| status | text | pending, fulfilled, expired |
| created_at | timestamptz | When imported |
| fulfilled_at | timestamptz | When account was created and pass assigned |

**New trigger: `auto_fulfill_pending_import`**

Fires when a new `non_member_profiles` row is inserted. Checks `pending_non_member_imports` for a matching email. If found:
- Creates the `class_passes` record automatically
- Marks the import as `fulfilled`

### New UI Component

**`src/components/admin/BulkNonMemberImport.tsx`**

A form on the Non-Member Accounts page (collapsible, like the existing Stripe Import section) where you can:
- Add multiple people with name, email, phone, and pass type
- Review the list before submitting
- One-click to insert all pending records and send activation emails

### Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create `pending_non_member_imports` table + trigger |
| `src/components/admin/BulkNonMemberImport.tsx` | New bulk import form |
| `src/pages/admin/NonMemberAccounts.tsx` | Add the bulk import section (similar to Stripe import collapsible) |

### Immediate Data Insert (Step 1)

For the 3 existing users, class passes will be inserted with:
- **category**: `pilates_cycling`
- **pass_type**: `10-pack`
- **classes_total**: 10
- **classes_remaining**: 10
- **price_paid**: 0 (admin grant)
- **expires_at**: 90 days from now
- **status**: `active`

