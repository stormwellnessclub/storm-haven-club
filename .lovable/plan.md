
## Non-Member Class Portal

A dedicated portal for non-members (users with auth accounts but no membership) to manage their class activity, purchase services, maintain payment methods, and contact support.

### New Routes (`/portal/*`)

All routes protected by a new `ProtectedPortalRoute` that requires auth but explicitly excludes members (redirects members to `/member`).

| Route | Purpose |
|-------|---------|
| `/portal` | Dashboard: upcoming bookings, recent purchases, quick actions |
| `/portal/bookings` | Class history (past) and upcoming bookings with cancel |
| `/portal/passes` | View owned class passes and credits, link to buy more |
| `/portal/payment-methods` | Saved cards (add/remove/default) -- card on file required |
| `/portal/payment-history` | Purchase/charge history |
| `/portal/profile` | Edit name, email, phone |
| `/portal/support` | Support messaging with "Class Support" tab |
| `/portal/wellness` | Book recovery services (Red Light Therapy, Dry Cryo) |

### New Components and Files

**1. `src/components/portal/ProtectedPortalRoute.tsx`**
- Requires authenticated user
- If user has an active/pending member record, redirect to `/member`
- Otherwise render children (non-member portal)

**2. `src/components/portal/PortalLayout.tsx`**
- Similar structure to `MemberLayout` (sidebar + header + main content)
- Uses `SidebarProvider` with a `PortalSidebar`
- No membership-specific notices (no freeze, annual fee, activation banners)
- Shows a "Card Required" banner if no payment method on file

**3. `src/components/portal/PortalSidebar.tsx`**
- Sidebar navigation with items: Dashboard, My Bookings, My Passes, Book Classes (links to /schedule), Buy Passes (links to /class-passes), Recovery Booking, Payment Methods, Payment History, Support, Profile
- Footer: Back to Website, Sign Out

**4. Portal Pages** (new files under `src/pages/portal/`)

- **Dashboard.tsx** -- Welcomes user, shows upcoming bookings count, active passes summary, quick action buttons (Book Class, Buy Pass, Recovery). Shows "Add Card" prompt if no card on file.
- **Bookings.tsx** -- Reuses `useUpcomingBookings` and `usePastBookings` hooks (already query by `user_id`, not `member_id`)
- **Passes.tsx** -- Queries `class_passes` table for user's passes, shows remaining credits and expiry
- **PaymentMethods.tsx** -- Adapts from member PaymentMethods page but without membership-specific logic. Enforces at least one card on file.
- **PaymentHistory.tsx** -- Shows Stripe charges/invoices for the user's Stripe customer
- **Profile.tsx** -- Edit profile info from `profiles` table
- **Support.tsx** -- Same messaging UI as member support but with a "Class Support" tab (uses category `'class_support'` on `email_conversations`)
- **Recovery.tsx** -- Book Red Light Therapy and Dry Cryo sessions (non-member pricing)

**5. `src/App.tsx` Updates**
- Add all `/portal/*` routes wrapped in `ProtectedPortalRoute`

### Card on File Enforcement

- On portal dashboard and before any booking/purchase, check if the user has a Stripe customer with a saved payment method
- If no card on file, show a prominent banner/modal directing them to add one
- Reuse `AddCardModal` component (already exists for members)
- The stripe-payment edge function's `create_admin_setup_intent` and `sync_member_card_metadata` actions will need a small adaptation to work with non-member users (using `user_id` lookup instead of `member_id`)

### Support -- "Class Support" Tab for Non-Members

- The existing `email_conversations.category` column already supports custom values
- Non-member support page will have two tabs: "Support" (general, category `'support'`) and "Class Support" (category `'class_support'`)
- Admin Email Management page will show a new filter/tab for "Class Support" conversations alongside existing "Support" and "Concierge" tabs

### Recovery Booking for Non-Members

- Create a simplified version of the member wellness booking page
- Non-members pay per session (no credits system) via Stripe checkout
- Services: Red Light Therapy and Dry Cryo

### Database Changes

- Add a `non_member_profiles` table to store non-member user details (name, phone, stripe_customer_id, card metadata) since these users don't have `members` records
- RLS: users can read/update their own row; staff can read all

### Technical Notes

- The `class_passes` and `class_bookings` tables already have `user_id` columns, so non-members with auth accounts already work with the booking system
- The existing `/class-passes` purchase page and `/schedule` booking page already support non-members -- the portal just gives them a home base
- The `useEmailConversations` hook already filters by the authenticated user's ID, so it works as-is for non-members
- Payment method management will need a new edge function action (`create_nonmember_setup_intent`) that creates/finds a Stripe customer by email and returns a SetupIntent

### Files to Create (summary)

```text
src/components/portal/ProtectedPortalRoute.tsx
src/components/portal/PortalLayout.tsx
src/components/portal/PortalSidebar.tsx
src/pages/portal/Dashboard.tsx
src/pages/portal/Bookings.tsx
src/pages/portal/Passes.tsx
src/pages/portal/PaymentMethods.tsx
src/pages/portal/PaymentHistory.tsx
src/pages/portal/Profile.tsx
src/pages/portal/Support.tsx
src/pages/portal/Recovery.tsx
```

### Files to Modify

- `src/App.tsx` -- Add portal routes
- `supabase/functions/stripe-payment/index.ts` -- Add `create_nonmember_setup_intent` and `list_nonmember_payment_methods` actions
- `src/pages/admin/EmailManagement.tsx` -- Add "Class Support" filter tab
- `src/components/admin/CheckInSupportPanel.tsx` -- Show class support items

### Migration

- Create `non_member_profiles` table with columns: `id`, `user_id` (FK to auth.users, unique), `first_name`, `last_name`, `phone`, `email`, `stripe_customer_id`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year`, `created_at`, `updated_at`
- RLS policies for self-access and staff access
