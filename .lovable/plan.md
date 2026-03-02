

# Upgrade Non-Member Admin Detail to Full CRM

## Overview
Transform the Non-Member Detail page from a basic profile viewer into a full-featured CRM that matches the Member Detail page. This enables admins to manage non-members with the same power they have for members: charging for services, managing cards, viewing detailed class credits, booking history, and more.

## What Changes

### 1. Tabbed Layout (Profile | Passes & Bookings | Payments)
Replace the current flat 2-column layout with a tabbed interface:
- **Profile tab**: Contact info (editable), waiver status, card on file with add/update capability, quick actions
- **Passes & Bookings tab**: Detailed class passes with progress bars, full booking history table with time/instructor/credits used, credit usage tracking, add package form
- **Payments tab**: Charge Item Selector (POS) for selling cafe items, wellness services, class passes, and custom amounts; plus charge history

### 2. Detailed Class Passes with Progress Bars
Upgrade the basic pass list to rich cards showing:
- Visual progress bars (classes_remaining / classes_total)
- Color-coded active vs expired/exhausted states
- Category labels with proper display names
- Expiration dates with warnings for soon-to-expire passes
- Edit button (super_admin only, already exists)

### 3. Full Booking History Table
Replace the basic 20-item list with a proper data table:
- Remove the limit(20) cap, increase to 100
- Add columns: Date, Time, Class Name, Instructor, Status, Credits Used
- Join class_sessions with instructors table for instructor names
- Sort by session date descending

### 4. Credit Usage Tracking
Add a "Credit Usage History" section showing:
- Which bookings consumed pass credits
- Date, class name, and credits deducted
- Query class_bookings where credits_used > 0

### 5. Add/Update Card on File
Integrate the existing AdminAddCardForm component:
- Create SetupIntent via the stripe-payment edge function using the non-member's stripe_customer_id
- On success, refresh card info from Stripe
- Show the same card management UI as MemberDetail

### 6. POS / Charge Item Selector for Non-Members
Adapt ChargeItemSelector to work with non-members:
- Add optional `stripeCustomerId` and `userId` props as alternatives to the `member` prop
- When charging a non-member, pass `stripeCustomerId` directly to the edge function instead of looking it up via memberId
- This enables selling: cafe items, recovery sessions, class passes, guest passes, custom amounts

### 7. Charge History
Show past charges from the manual_charges table filtered by user_id, displaying amount, description, date, and status.

### 8. People Search Enhancement
Update the People page to also search non-members by phone number, improving discoverability for walk-in customers.

## Technical Details

### Files to Modify
- **src/pages/admin/NonMemberDetail.tsx** -- Major refactor: add tabs, progress bars, full booking table, card management, charge history, POS integration
- **src/components/admin/ChargeItemSelector.tsx** -- Add optional `stripeCustomerId` + `userId` props; when provided, charge via customer ID directly instead of member lookup
- **src/pages/admin/People.tsx** -- Add phone to non-member search query

### Edge Function Updates
- **stripe-payment**: The `charge_saved_card_with_3ds` action may need a small update to accept `stripeCustomerId` directly (the guest management system already uses this pattern, so it may already work)

### No Database Changes Needed
- `class_bookings` already has `user_id` and `credits_used` columns
- `manual_charges` already has `user_id` column
- `non_member_profiles` already has all card metadata columns
- `class_passes` already has `user_id` column

### Key Architectural Decisions
- ChargeItemSelector will accept an optional `nonMember` prop containing `{userId, stripeCustomerId, firstName, lastName}` as an alternative to the `member` prop
- When `nonMember` is provided, charges go through `stripeCustomerId` and records use `user_id` instead of `member_id`
- The booking history query will join through `class_sessions` -> `instructors` and `class_sessions` -> `class_types` for full context
- Card management reuses the existing `AdminAddCardForm` + `StripeProvider` components with the non-member's `stripe_customer_id`

