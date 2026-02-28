

# Blocked/Banned Access System

## Overview
Create a universal block list that prevents specific people (members and non-members) from entering the club, booking services, or accessing the portal. Blocked users see an "Access Revoked" screen instead of the normal portal.

## Database Changes

### New table: `blocked_persons`
Stores blocked individuals by email (the universal identifier across members and non-members).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| email | text (unique, not null) | Lowercase, the lookup key |
| full_name | text | For admin display |
| reason | text | Why they were blocked (e.g., "Filed dispute after refund") |
| blocked_by | uuid (FK -> auth.users) | Staff who blocked them |
| blocked_at | timestamptz | Default now() |
| member_id | uuid (nullable) | Reference to members table if applicable |
| notes | text | Additional admin notes |

RLS: Read/write restricted to admin, super_admin, and manager roles.

### Update `process_member_scan` (both overloads)
Add a check at the top: if the scanned member's email exists in `blocked_persons`, immediately return access denied with reason `'access_revoked'`.

### Update `create_atomic_class_booking`
Add a check: if the booking user's email is in `blocked_persons`, reject with "Your access has been revoked. Please contact the club."

## Frontend Changes

### 1. Access Revoked Screen (`src/components/member/AccessRevoked.tsx`)
A full-page component shown to blocked users:
- Large red shield/ban icon
- "Access Revoked" heading
- "Your access to Storm Wellness Club has been revoked. If you believe this is an error, please contact us at [email/phone]."
- Sign out button

### 2. Member Portal Guard (`ProtectedMemberRoute.tsx`)
After session validation, before status checks: query `blocked_persons` for the current user's email. If found, render `<AccessRevoked />` instead of children.

### 3. Non-Member Portal Guard (`ProtectedPortalRoute.tsx`)
Same check -- query `blocked_persons` for the user's email. If blocked, show `<AccessRevoked />`.

### 4. `useApplicationStatus.ts`
Add a `"blocked"` status. Before all other checks, query `blocked_persons` by email. If found, return `{ status: "blocked" }`.

### 5. Effective Status Badge (`EffectiveStatusBadge.tsx`)
Add `'blocked'` to the status union type with a red/black `ShieldX` icon and label "Blocked".

### 6. Admin: Block/Unblock UI
- **Member Detail page** (`MemberDetail.tsx`): Add a "Block Member" action button (in the danger zone or actions dropdown). Opens a dialog asking for a reason, then inserts into `blocked_persons`.
- **Non-Member Detail page** (`NonMemberDetail.tsx`): Same "Block" action.
- **Blocked Persons admin page** (`/admin/blocked`): A simple table listing all blocked people with the ability to unblock (delete from `blocked_persons`). Accessible from the admin sidebar.

### 7. Scanner Updates
The `process_member_scan` RPC changes will cause the scanner to show "Access Revoked" for blocked members. Add `'access_revoked'` as a recognized denial reason in `Scanner.tsx` with distinct messaging.

## Enforcement Summary

| Touchpoint | How it's blocked |
|------------|-----------------|
| Member portal login | `ProtectedMemberRoute` shows AccessRevoked screen |
| Non-member portal login | `ProtectedPortalRoute` shows AccessRevoked screen |
| QR scanner entry | `process_member_scan` RPC denies with `access_revoked` |
| Manual check-in | Effective status shows "Blocked" -- cannot check in |
| Class booking | `create_atomic_class_booking` RPC rejects |
| Guest pass purchase | Blocked at portal level (can't access) |

## Technical Details

### Files to create
- `src/components/member/AccessRevoked.tsx` -- Full-page revoked access screen
- `src/pages/admin/BlockedPersons.tsx` -- Admin management page
- Migration SQL for `blocked_persons` table + RLS + RPC updates

### Files to modify
- `src/components/member/ProtectedMemberRoute.tsx` -- Add blocked check
- `src/components/portal/ProtectedPortalRoute.tsx` -- Add blocked check
- `src/hooks/useApplicationStatus.ts` -- Add "blocked" status
- `src/components/admin/EffectiveStatusBadge.tsx` -- Add blocked status config
- `src/pages/admin/Scanner.tsx` -- Handle `access_revoked` denial reason
- `src/pages/admin/MemberDetail.tsx` -- Add block action
- `src/pages/admin/NonMemberDetail.tsx` -- Add block action
- `src/App.tsx` -- Add `/admin/blocked` route
- Admin sidebar -- Add "Blocked" nav link

