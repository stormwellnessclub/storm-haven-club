

# Unified Check-In Hub

## Problem
The current Check-In page only searches the `members` table and only counts/displays member check-ins. Guests (guest passes), class attendees (class bookings), and spa visitors don't appear in the check-in flow or today's attendance count.

## Solution
Transform the Check-In page into a **Unified Check-In Hub** that searches across all visitor types and shows a combined today's attendance feed.

## Changes

### 1. Unified Person Search on Check-In Page
Replace the members-only search with a search that queries across:
- **Members** (existing)
- **Guest Passes** (today's active guest passes by guest name/email)
- **Class Bookings** (today's confirmed bookings, including non-member walk-ins)
- **Spa Appointments** (today's confirmed appointments)

Each search result gets a **type label**:
- "Member" -- standard member check-in
- "Guest Pass" -- guest visiting on a day pass
- "Class Booking" -- person here for a class (shows class name)
- "Spa Appointment" -- person here for a spa service (shows service name)

### 2. Context-Aware Detail Panel
When a person is selected, the right panel adapts:
- **Member**: Current behavior (status banner, membership info, check-in button inserts into `check_ins`)
- **Guest Pass**: Shows guest name, pass status, valid date, referring member. "Check In" marks the guest pass as `used` (updates `used_at`, `checked_in_by`, status to `used`)
- **Class Booking**: Shows class name, time, booking status. "Check In" updates `class_bookings.checked_in_at` and sets status to `completed`
- **Spa Appointment**: Shows service name, time, duration. "Check In" updates `spa_appointments.checked_in_at`

### 3. Unified Today's Attendance Feed
Replace the members-only check-in list with a combined feed pulling from:
- `check_ins` table (members) -- labeled "Member"
- `guest_passes` where `used_at` is today -- labeled "Guest"
- `class_bookings` where `checked_in_at` is today -- labeled "Class"
- `spa_appointments` where `checked_in_at` is today -- labeled "Spa"

Each row shows the person's name, a colored type badge, and the check-in time. The total count at the top reflects **all** visitor types combined.

### 4. Updated Stats Cards
- "Total Check-Ins" counts all types combined
- "Currently In" remains member-only (only `check_ins` has `checked_out_at`)
- Add a third stat: breakdown by type (e.g., "12 Members, 3 Guests, 5 Class, 2 Spa")

## Technical Details

### Files to modify
- `src/pages/admin/CheckIn.tsx` -- Major refactor of search, detail panel, attendance feed, and stats

### No database changes needed
All the tables already have the necessary columns:
- `guest_passes`: `used_at`, `checked_in_by`, `status`
- `class_bookings`: `checked_in_at`, `status`
- `spa_appointments`: `checked_in_at`

### Search approach
A single search input queries in parallel:
1. `members` by name/email/member_id/phone (existing)
2. `guest_passes` (today, active) by `guest_name`/`guest_email`
3. `class_bookings` joined with `class_sessions` (today, confirmed) joined with `members`/`non_member_profiles` by name
4. `spa_appointments` (today, confirmed) joined with `members` by name

Results are deduplicated and merged into a unified list with type badges.

### Detail panel
Uses a discriminated union type (e.g., `SelectedPerson`) with `type` field to render the appropriate detail view and check-in action for each visitor type.

