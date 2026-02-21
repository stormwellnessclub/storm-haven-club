

## Redesign: Full-Page Non-Member Account Management

### Problem

The current Non-Member Accounts page crams everything into small tabs and a narrow slide-out sheet. You can't edit anything inline, you have to copy-paste emails between tabs, and the detail view is a tiny sidebar. Compare this to the Member Detail page (`/admin/members/:id`) which gives a full page with inline editing, tabbed sections, and direct action buttons -- that's the standard we need to match.

### Solution

Replace the fragmented tabbed layout with a **master-detail pattern**:

1. **List View** (`/admin/non-member-accounts`) -- Full-width table of all non-member accounts with search, filters, and quick-action buttons directly in each row (add package, send activation, view detail)
2. **Detail View** (`/admin/non-member-accounts/:userId`) -- A dedicated full-page view for each non-member (modeled after the Member Detail page) with:
   - Editable profile section (name, email, phone) with inline edit/save
   - Card on file display with Stripe refresh
   - Waiver status with toggle
   - Class passes section with ability to add packages directly from this page
   - Booking history
   - Quick actions: Send activation email, add package, refresh card -- all without leaving the page

The Stripe Import tool stays as a standalone section accessible from the list view header since it's a bulk operation, not per-account.

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/admin/NonMemberAccounts.tsx` | Rewrite as a clean list page with row actions, remove tabs, add route to detail page |
| `src/App.tsx` | Add route `/admin/non-member-accounts/:userId` |
| `src/lib/permissions.ts` | Add detail route permission |

**Files to create:**

| File | Purpose |
|------|--------|
| `src/pages/admin/NonMemberDetail.tsx` | Full-page detail view for a single non-member account |

**Files to remove/deprecate:**

| File | Reason |
|------|--------|
| `src/components/admin/NonMemberDetailSheet.tsx` | Replaced by the full-page detail view |

---

### List Page Redesign (`/admin/non-member-accounts`)

- Remove the 4-tab layout entirely
- Full-width accounts table with search bar
- Each row has a dropdown menu (like the Members page) with:
  - "View Details" (navigates to `/admin/non-member-accounts/:userId`)
  - "Add Package" (opens inline dialog)
  - "Send Activation Email" (one-click action)
- Header area includes:
  - "Import from Stripe" button that opens a dialog/collapsible for the Stripe import tool
  - "Send Activation Link" button that opens a quick email input dialog
- Summary stats at the top: total accounts, accounts with active passes, accounts missing waivers

### Detail Page (`/admin/non-member-accounts/:userId`)

Modeled after `MemberDetail.tsx`, this full-page view includes:

**Header Section:**
- Back button to list
- Breadcrumb navigation
- Name, email, join date prominently displayed
- Edit/Save toggle for profile fields

**Left Column (Profile and Billing):**
- Editable profile card: first name, last name, email, phone
- Card on file card with Stripe refresh button
- Waiver status card with admin override toggle

**Right Column (Passes and Activity):**
- Class Passes card showing all active and expired passes with remaining counts
- Inline "Add Package" form (category, pass type, expiration) -- no need to navigate away
- Recent Bookings card with class name, date, and status
- Quick Actions card: Send activation email, refresh card from Stripe

### Key Improvements Over Current Design

1. **No more copy-pasting** -- Actions like "Add Package" are embedded in the detail page with the user's info pre-filled
2. **Full page width** -- No more cramped sheet sidebar; the detail view uses the entire content area
3. **Inline editing** -- Edit profile fields directly on the page, just like Member Detail
4. **Row-level actions** -- Common tasks accessible from the list view without navigating
5. **Consistent with Member management** -- Follows the same patterns staff already know from managing members
