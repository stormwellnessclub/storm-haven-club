

# Fix Front Desk Kiosk — Make It Actually Standalone

## The Problem

The current `/front-desk` page is a copy-paste of the admin check-in with a different layout wrapper. It:
- Still requires an admin login session (hooks use `useAuth()` internally)
- Shows billing details, effective status breakdowns, member IDs, subscription info
- Uses `useMemberScanner` which calls `process_member_scan` RPC requiring `user.id`
- Uses `useMembersBillingIssues` which pulls Stripe/billing data trainees shouldn't see

So if you're logged in as admin it "works" but shows everything. If you're not logged in, nothing works at all. Either way it's wrong.

## The Fix

### 1. Create a kiosk-safe check-in RPC (database migration)
A new `kiosk_check_in_member` RPC that:
- Takes a member ID text (name/email/member_id search)
- Validates member status (active = allow, anything else = deny)
- Creates a `check_ins` row with `checked_in_by = null` (kiosk)
- Returns only: name, photo, membership type, access granted/denied, denial reason
- Does NOT return billing details, Stripe info, or subscription status
- Runs as `SECURITY DEFINER` so it works without an authenticated user session

### 2. Create a kiosk-safe search RPC (database migration)
A new `kiosk_search_visitors` RPC that:
- Searches members, guest passes, class bookings, spa appointments for today
- Returns only front-desk-safe fields (name, type, time, class name — no billing, no member profile links)
- Runs as `SECURITY DEFINER`

### 3. Create kiosk-specific hooks
- `src/hooks/useKioskCheckIn.ts` — calls the new RPCs instead of `useMemberScanner` + `useMembersBillingIssues`
- `src/hooks/useKioskSearch.ts` — simplified search that doesn't need auth
- `src/hooks/useKioskAttendance.ts` — fetches today's attendance with only safe fields (name, type, time)

### 4. Rewrite `src/pages/FrontDesk.tsx`
Strip out all admin-level imports and replace with kiosk hooks:
- Remove `useMembersBillingIssues`, `useMemberScanner`, `useAuth`, `EffectiveStatusBadge`, `getEffectiveStatus`
- Remove billing status panel, arrears detail, member ID display
- Member detail shows: name, photo, membership type, and a simple green/red "Can Check In" / "Cannot Check In" (based on active status only)
- Guest/class/spa detail stays similar but simplified
- Attendance feed shows name + type + time only (no member ID, no subtitle with billing info)
- Support panel stays as-is (already works without auth since it queries directly)
- Kids Care and Classes panels stay as-is

### 5. Ensure PIN gate RPC works without auth
- Verify `verify_kiosk_pin` is callable by anon role (it should be since it was created as a public RPC)
- Verify `kiosk_settings` table has proper permissions for the anon key to call the verification RPC

## What changes
- **Migration**: 2 new RPCs (`kiosk_check_in_member`, `kiosk_search_visitors`) as `SECURITY DEFINER`
- **New**: `src/hooks/useKioskCheckIn.ts`
- **New**: `src/hooks/useKioskSearch.ts`  
- **New**: `src/hooks/useKioskAttendance.ts`
- **Rewrite**: `src/pages/FrontDesk.tsx` — swap all admin hooks for kiosk hooks, strip sensitive data

## What the front desk staff will see after this
- PIN entry → unlocks session
- Search bar → finds members/guests/class/spa by name
- Select a person → see name, photo, membership type, simple check-in button
- Green "approved" or red "denied" based on member status (no billing breakdown)
- Today's attendance list (name, type, time)
- Support tickets with inline reply
- Today's classes and kids care bookings
- No member IDs, no billing details, no Stripe info, no admin links

