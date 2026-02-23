

## Fix Class Pass Display, Booking Details, Quick Action Links, and Schedule Access

### Issues Identified

1. **Class Passes on Dashboard show "1 pass" icon instead of actual counts**: The Dashboard's "Class Passes" card already shows detailed pass info with progress bars and remaining/total counts. However, the **Non-Member Portal Dashboard** (`portal/Dashboard.tsx`) only shows a single number for "Active Passes" with no detail -- no category, no remaining/total breakdown, no expiration.

2. **Upcoming Classes only show "booked classes" count, no details**: The member Dashboard's "Upcoming Classes" stat card (lines 327-347) shows just a number and "booked classes" text. The detailed preview section below (lines 701-758) does show class name, date, and time, but the portal Dashboard shows nothing -- just a count.

3. **Portal Bookings page has no cancel option**: The portal bookings page (`portal/Bookings.tsx`) shows only class name, date, time, and status badge -- no cancel button for upcoming bookings.

4. **"Book a Class" quick action cards are not fully clickable**: In the member Dashboard (lines 637-698), the quick action cards have a small arrow button that links to `/schedule`, but the entire card is not clickable -- only the small icon button is a link.

5. **Members can't see the temp class schedule in the member portal**: The schedule page (`/schedule`) uses the public `Layout` wrapper, not `MemberLayout`. Members must leave their portal to view it. The sidebar link to "Book Classes" points to `/schedule` which opens with the website layout.

---

### Changes

#### 1. Fix Non-Member Portal Dashboard -- Show Pass Details
**File:** `src/pages/portal/Dashboard.tsx`

Replace the simple "Active Passes" count card with detailed pass information showing category, remaining/total classes, progress bars, and expiration dates. Query full pass data instead of just a count.

#### 2. Fix Non-Member Portal Dashboard -- Show Upcoming Booking Details
**File:** `src/pages/portal/Dashboard.tsx`

Replace the simple "Upcoming Bookings" count card with a list of the next 3 upcoming bookings showing class name, date, time, and a link to view all bookings.

#### 3. Add Cancel Option to Portal Bookings
**File:** `src/pages/portal/Bookings.tsx`

Add a cancel button to upcoming confirmed bookings, reusing the existing `useCancelBooking` hook. Include the same 24-hour late cancellation warning and confirmation dialog used in the member bookings page.

#### 4. Make Quick Action Cards Fully Clickable
**File:** `src/pages/member/Dashboard.tsx`

Wrap each quick action card in a `Link` component so the entire card is clickable, not just the small arrow icon button.

#### 5. Add Schedule Page Access Within Member Portal
**File:** `src/pages/member/Schedule.tsx` (new)

Create a new member schedule page that wraps the existing `TempClassSchedule` component inside `MemberLayout`, so members can view and book classes without leaving their portal.

**File:** `src/App.tsx`

Add a route for `/member/schedule` pointing to the new page.

**File:** `src/components/member/MemberSidebar.tsx`

Update the "Book Classes" sidebar link from `/schedule` to `/member/schedule`.

---

### Technical Details

**Files to create:**
| File | Purpose |
|------|---------|
| `src/pages/member/Schedule.tsx` | Member portal wrapper for TempClassSchedule |

**Files to modify:**
| File | Change |
|------|--------|
| `src/pages/portal/Dashboard.tsx` | Replace count-only cards with detailed pass and booking info |
| `src/pages/portal/Bookings.tsx` | Add cancel button with confirmation dialog for upcoming bookings |
| `src/pages/member/Dashboard.tsx` | Make quick action cards fully clickable as links |
| `src/components/member/MemberSidebar.tsx` | Point "Book Classes" to `/member/schedule` |
| `src/App.tsx` | Add `/member/schedule` route |

**No database changes needed.**

