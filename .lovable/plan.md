

## Plan: Add "Request Hours" Feature for Kids Care

### What We're Building
A section on the Kids Care bookings page where parents can submit the days and times they need for Kids Care, plus a note explaining we're actively expanding hours based on demand. Admin gets a new tab to view all submitted requests.

### Database
Create a new `kids_care_hour_requests` table:
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, not null)
- `preferred_days` (text[], e.g. `['Monday', 'Wednesday', 'Friday']`)
- `preferred_start_time` (time)
- `preferred_end_time` (time)
- `notes` (text, optional)
- `created_at` (timestamptz)
- `status` (text, default 'pending' — pending/reviewed/accommodated)

RLS: authenticated users can insert their own rows and read their own; admin roles can read all.

### Member Portal (`src/pages/member/KidsCareBookings.tsx`)
Add a new section after the "Upcoming Open Hours" block:
- Explanatory note: "We're expanding Kids Care hours based on parent demand. Let us know the days and times that work best for your family, and we'll do our best to accommodate as we grow."
- Simple form: multi-select checkboxes for days of the week, start/end time selects, optional notes textarea, submit button
- Show the user's previous requests below the form

### Admin Portal (`src/pages/admin/Childcare.tsx`)
Add a new "Hour Requests" tab showing a table of all parent requests with:
- Parent name/email, preferred days, preferred times, notes, submitted date, status dropdown (pending/reviewed/accommodated)

### New Hook
Create `src/hooks/useKidsCareHourRequests.ts` with:
- `useMyHourRequests()` — member's own requests
- `useSubmitHourRequest()` — mutation to insert
- `useAdminHourRequests()` — all requests (admin)
- `useUpdateHourRequestStatus()` — admin status update

### Files Changed
| File | Change |
|------|--------|
| Migration | Create `kids_care_hour_requests` table + RLS |
| `src/hooks/useKidsCareHourRequests.ts` | New hook file |
| `src/pages/member/KidsCareBookings.tsx` | Add request form + explanatory banner |
| `src/pages/admin/Childcare.tsx` | Add "Hour Requests" tab |

