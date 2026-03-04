

# Full Member Portal UX Overhaul

Combining all discussed improvements into one implementation.

## Changes

### 1. Support Button in Header (`MemberLayout.tsx`)
- Add a `MessageCircle` icon button linking to `/member/support` in the sticky header, next to the User icon
- Desktop: icon + "Support" text. Mobile: icon only

### 2. Move Support to #3 in Sidebar (`MemberSidebar.tsx`)
- Move Support from position #11 to position #3 (after Dashboard, Member Entry)

### 3. Restructure Dashboard Top Section (`Dashboard.tsx`)
Reorder the dashboard so the most actionable content appears first:

**New order after alerts + welcome:**
1. **Quick Actions row** — "Book Class", "Book Amenity" (wellness), "Buy Passes" as prominent buttons (moved from line 632-693)
2. **Up Next section** — Upcoming class bookings + wellness appointments combined, sorted by date, max 3 items (moved from line 695-751, enhanced with wellness bookings query)
3. Quick Stats cards (membership, credits, passes, etc.) — stays but moves down
4. Health & Wellness section — stays in current position relative to stats

This means the current "Quick Actions" (lines 632-693) and "Upcoming Classes" (lines 695-751) sections at the bottom get removed and replaced by their new versions at the top.

### 4. Mobile Bottom Tab Bar (`MemberBottomNav.tsx` — new file)
Fixed bottom nav visible on mobile only (`md:hidden`) with 5 tabs:
- **Home** → `/member`
- **Book** → `/member/schedule`
- **Entry** → `/member/entry`
- **Credits** → `/member/credits`
- **More** → opens sidebar

Add `pb-16 md:pb-0` to main content area in `MemberLayout.tsx` to prevent overlap.

### 5. Collapsible Sidebar Groups (`MemberSidebar.tsx`)
Reorganize 23 flat links into collapsible groups using Radix `Collapsible`:
- **Main** (always visible): Dashboard, Entry, Support, Book Classes
- **Membership & Billing** (collapsible): My Membership, Credits, Payment Methods, Payment History, Buy Passes
- **Bookings & Visits** (collapsible): My Bookings, Visit History, Wellness Booking
- **Health & Wellness** (collapsible): Health Score, Workouts, Habits, Goals, Achievements, Fitness Profile
- **Account** (collapsible): My Profile, Waivers, Freeze Request, Register Guest, Refer a Friend

Groups auto-expand based on active route.

### 6. Banner Consolidation (`NotificationBar.tsx` — new file)
Replace stacking banners in `MemberLayout.tsx` with a single `NotificationBar`:
- Shows highest-priority notice
- Badge with count if multiple
- Tap to expand and see all
- Dismissible per session

## Files

| File | Action |
|------|--------|
| `src/components/member/MemberLayout.tsx` | Add Support header button, add `MemberBottomNav`, replace banners with `NotificationBar`, add mobile bottom padding |
| `src/components/member/MemberSidebar.tsx` | Reorganize into collapsible groups, move Support to top |
| `src/pages/member/Dashboard.tsx` | Move quick actions + upcoming bookings to top, add wellness appointments |
| `src/components/member/MemberBottomNav.tsx` | **New** — fixed mobile bottom tab bar |
| `src/components/member/NotificationBar.tsx` | **New** — consolidated dismissible banner |

## No database changes required.

