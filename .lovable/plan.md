
## Build Non-Member Admin Management Hub

### Problem
The current "Non-Member Portal" link in the admin sidebar points to `/portal`, which is the self-service portal for non-members. When an admin visits it, they see end-user prompts like "Add a card on file" -- this is not an admin tool.

### Solution
Replace that link with a proper admin page at `/admin/non-member-accounts` that gives staff full control over non-member class pass holders.

---

### New Page: `/admin/non-member-accounts`

A tabbed admin interface inside AdminLayout with four sections:

#### Tab 1: Accounts Overview
- Query `non_member_profiles` joined with `class_passes` (via user_id) to list all non-member accounts
- Display table: name, email, phone, card on file (brand/last4), waiver status, active passes count, total spent
- Clicking a row opens a detail sheet showing:
  - Full profile info
  - Card on file details with "Refresh from Stripe" button
  - Waiver status
  - All class passes (active + expired) with remaining/total counts
  - Booking history

#### Tab 2: Add Package
- Search for a non-member by email
- Select class category (Pilates/Cycling, Other Classes) and pass type (single, 10-pack)
- Set expiration date and class count
- Creates a `class_passes` record linked to their `user_id`
- Metadata marks it as "admin_grant" for audit trail

#### Tab 3: Stripe Import
- Input a Stripe price ID (pre-filled dropdown with known class pass price IDs from `stripeProducts.ts`)
- Calls edge function to fetch completed Checkout Sessions from Stripe for that price
- Shows preview table: customer email, date, amount, product name
- Matches emails to existing auth accounts
- On confirm, creates `class_passes` records for matched purchases
- Lists unmatched emails so admin can send activation links

#### Tab 4: Send Activation Link
- Enter an email address for someone who purchased via Stripe but has no account
- Sends a branded email with a link to `/auth?redirect=/portal`
- Uses existing `send-email` edge function with a new template

---

### Technical Details

**Files to create:**

| File | Purpose |
|------|---------|
| `src/pages/admin/NonMemberAccounts.tsx` | Main admin hub page with 4 tabs |
| `src/components/admin/NonMemberDetailSheet.tsx` | Slide-out detail view for individual non-member |
| `src/components/admin/NonMemberStripeImport.tsx` | Stripe import tool UI |
| `src/components/admin/NonMemberAddPackage.tsx` | Manual package grant form |

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/admin/AdminSidebar.tsx` | Change "Non-Member Portal" link from `/portal` to `/admin/non-member-accounts` |
| `src/lib/permissions.ts` | Add `/admin/non-member-accounts` with roles `super_admin, admin, manager, front_desk`; remove `/portal` entry |
| `src/App.tsx` | Add route for `/admin/non-member-accounts` wrapped in `ProtectedAdminRoute` |

**Edge function changes (`supabase/functions/stripe-payment/index.ts`):**

Three new actions:
1. `admin_import_stripe_class_passes` -- Fetches Stripe Checkout Sessions by price ID, returns preview data; on confirm, creates `class_passes` records
2. `admin_add_nonmember_package` -- Inserts a `class_passes` record for a user with category, pass type, expiration, and audit metadata
3. `admin_refresh_nonmember_card` -- Looks up a non-member's Stripe customer by email, fetches default payment method, updates `non_member_profiles`

All three actions verify the caller has an admin/manager role before executing.

**Edge function changes (`supabase/functions/send-email/index.ts`):**

Add `account_activation_invite` template type that sends a branded email with a sign-up/sign-in link redirecting to `/portal`.

---

### Sidebar Change
The sidebar entry changes from:
```
{ title: "Non-Member Portal", url: "/portal", ... }
```
to:
```
{ title: "Non-Member Accounts", url: "/admin/non-member-accounts", ... }
```

This keeps everything within the admin context and eliminates the confusing redirect to the end-user portal.

### No Database Schema Changes Required
All data uses existing tables: `non_member_profiles`, `class_passes`, `auth.users`.
