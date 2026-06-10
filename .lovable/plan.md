## Problem

History/Upcoming views in both the **member portal** (`/member/bookings`) and **non-member portal** (`/portal/bookings`, `/portal` dashboard) only query `class_bookings`. Past spa visits (Red Light, Cryo, Massage, etc.) and PT sessions never appear, and non-members can't see upcoming spa appointments at all.

## Fix (UI only — no schema changes)

### 1. Unified "appointment history" hook
Create `src/hooks/useAllAppointmentHistory.ts` that, for the current `user.id`, fetches in parallel:
- `class_bookings` (existing logic) — already covered, keep separate
- `spa_appointments` where `user_id = auth.uid()` — both upcoming (`appointment_date >= today` and status in `confirmed, pending, checked_in, in_progress`) and past (everything else, including `completed`, `cancelled`, `no_show`)
- `pt_appointments` where `user_id = auth.uid()` — upcoming (`starts_at >= now` and `status = scheduled`) and past (anything else or `starts_at < now`)

Returns `{ upcomingSpa, pastSpa, upcomingPT, pastPT }` with resolved instructor/therapist names.

### 2. Member `My Bookings` page (`src/pages/member/Bookings.tsx`)
- Keep existing class tabs.
- In the **Past** tab, append two new sections below class history:
  - "Past Spa & Recovery" — list spa appointments (service name, date/time, therapist, status badge)
  - "Past Personal Training" — list PT appointments (format label via `PT_FORMAT_LABEL`, date/time, trainer, status)
- In the **Upcoming** tab, append "Upcoming Spa & Recovery" section listing upcoming spa appointments with a "Cancel" button that calls the existing spa cancel flow. (PT upcoming already shown via `UpcomingPTAppointmentsCard` on dashboard — add it here too for parity.)

### 3. Non-member portal `Bookings` page (`src/pages/portal/Bookings.tsx`)
Same treatment: in both **Upcoming** and **Past** tabs, render class cards, then spa cards, then PT cards. Reuse the `UpcomingPTAppointmentsCard` for upcoming PT.

### 4. Non-member portal `Dashboard` (`src/pages/portal/Dashboard.tsx`)
Add a new `UpcomingSpaAppointmentsCard` (mirrors `UpcomingPTAppointmentsCard`) above "Upcoming Classes" so non-members see their next massage / Red Light / Cryo / etc. with the same date/time/therapist row.

### 5. Reusable presentation
Create `src/components/portal/SpaAppointmentRow.tsx` and `PTAppointmentRow.tsx` so the member page, portal bookings page, and dashboard cards render identically.

## Files

- new: `src/hooks/useAllAppointmentHistory.ts`
- new: `src/components/portal/UpcomingSpaAppointmentsCard.tsx`
- new: `src/components/portal/SpaAppointmentRow.tsx`
- new: `src/components/portal/PTAppointmentRow.tsx`
- edit: `src/pages/member/Bookings.tsx` — add spa + PT sections to Upcoming and Past tabs
- edit: `src/pages/portal/Bookings.tsx` — add spa + PT sections to Upcoming and Past tabs
- edit: `src/pages/portal/Dashboard.tsx` — mount `UpcomingSpaAppointmentsCard`

No DB migrations, no RLS changes (existing policies already allow `user_id = auth.uid()` reads on `spa_appointments` and `pt_appointments`).