

## Fix: Enrollment Count Mismatch + Convert Roster to Full-Page View

### Problem 1: Enrollment Numbers Don't Match

**Root cause**: The class cards on the management page display `current_enrollment` from the database (`class_sessions.current_enrollment`), but this counter frequently goes out of sync with the actual number of confirmed bookings. When you click into the roster, it counts the real bookings from `class_bookings` and silently corrects the number -- that's why you see one number on the card and a different number inside.

The mismatch happens because multiple operations (adding, removing, cancelling bookings) each try to manually increment/decrement `current_enrollment`, and if any step fails or runs out of order, the counter drifts.

**Fix**: Instead of trusting `current_enrollment`, fetch the actual confirmed booking count for each session directly. This makes the card numbers always accurate.

- **File to modify**: `src/components/admin/SoftLaunchClassManagement.tsx`
- **Change**: After fetching `class_sessions`, run a second query to get the real count of confirmed/completed bookings per session from `class_bookings`, and use that count on the cards instead of `current_enrollment`.

---

### Problem 2: Roster Opens as a Small Side Panel

**Root cause**: The roster currently uses a `Sheet` component (a slide-out side panel capped at `sm:max-w-2xl`). Per the admin portal design principles, all management interfaces should use full-page views, not small dialogs or sheets.

**Fix**: Convert the roster from a Sheet overlay to a full-page route at `/admin/class-roster/:sessionId`, following the same master-detail pattern used by Member Management and Staff Management.

- **New file**: `src/pages/admin/ClassRoster.tsx` -- A full-page roster view with all existing functionality (roster table, waitlist, add-to-class panel) but laid out across the full screen width.
- **Modify**: `src/components/admin/SoftLaunchClassManagement.tsx` -- Change the "View Roster" / "Manage" buttons to navigate to the new full-page route instead of opening a sheet.
- **Modify**: `src/App.tsx` -- Register the new `/admin/class-roster/:sessionId` route.
- **Modify**: `src/lib/permissions.ts` -- Add permission entry for the new route.

The new full-page layout will include:
- A back button to return to class management
- The class name, date, and time in the page header
- The roster table at full width with better spacing
- The waitlist tab alongside the roster
- The add-to-class panel as an expandable section (not crammed into a tiny sheet)

---

### Technical Details

#### Enrollment Count Fix (SoftLaunchClassManagement.tsx)

The current flow:
1. Fetch `class_sessions` with `current_enrollment` (often stale)
2. Display `slot.enrolled` on card

The new flow:
1. Fetch `class_sessions` as before
2. For sessions that exist in DB, batch-query `class_bookings` to count confirmed/completed bookings per `session_id`
3. Use the real count on the cards, and silently update `current_enrollment` if it differs

#### Full-Page Roster (new ClassRoster.tsx page)

- Uses `useParams()` to get the session ID from the URL
- Fetches session details, bookings, and waitlist using the same queries from `ClassRosterDialog.tsx`
- All mutation logic (check-in, remove, add, promote from waitlist) moves to the page
- The existing `ClassRosterDialog.tsx` file can be kept for backward compatibility or removed

#### Navigation Flow

- Admin clicks "View Roster" on a class card
- If no DB session exists yet, the system calls `ensureTempClassSession` to create it first, then navigates to `/admin/class-roster/{sessionId}`
- The roster page has a "Back to Classes" button that returns to the management view

