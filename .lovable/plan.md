## Spa "Leave a Review" Outreach Tab + Member Portal Tab

Add two new surfaces on top of the existing spa reviews system so members can easily leave reviews for past treatments, and admins can see who hasn't reviewed yet and nudge them.

### 1. Admin → Spa Management → "Leave a Review" tab

A new tab next to the existing **Reviews** tab (which shows submitted reviews). This new tab is an outreach list — every completed spa appointment with the client and review status.

Columns:
- Client name + email/phone
- Service + therapist
- Appointment date
- Status badge: **Reviewed** (with stars) / **Pending review**
- Actions: **Copy review link**, **Send via email**, **Send via SMS**

Filters:
- Status: All / Pending / Reviewed
- Service, therapist, date range
- Search by name/email

The "review link" deep-links to the member portal review tab with the appointment pre-selected (e.g. `/portal/reviews?appointment=<id>`). Email/SMS reuse existing send infra (same pattern as other admin nudges).

Admins do **not** submit reviews on behalf of clients — they only send/copy the link.

### 2. Member portal → "Reviews" tab

New sidebar item under the portal. Shows the member's full spa history with a per-row review action.

Sections:
- **Pending reviews** — completed appointments without a review → "Leave a review" button opens `SpaReviewDialog`
- **My reviews** — appointments already reviewed → shows their stars/text, "Edit" button (reuses existing `useUpdateSpaReview`)

Deep link support: if URL has `?appointment=<id>`, auto-open the review dialog for that appointment.

The existing `LeaveSpaReviewBanner` on `/portal/bookings` stays — this new tab is the dedicated home for review management.

### 3. Technical details

**New RPC** `get_all_spa_appointments_review_status(filters)` (admin-only, SECURITY DEFINER, gated by `has_any_role`):
- Returns every `spa_appointments` row with `status = 'completed'` joined to `spa_reviews` (left join on `appointment_id`)
- Fields: appointment id, user_id, client name/email/phone, service name, therapist name, appointment date/time, review id (nullable), rating, review_text, is_visible

**New files:**
- `src/components/admin/spa/SpaLeaveReviewOutreachTab.tsx` — table + filters + send/copy actions
- `src/pages/portal/Reviews.tsx` — member portal page (Pending + My Reviews)
- `src/hooks/useSpaReviewOutreach.ts` — admin RPC query + send-link mutation

**Edited files:**
- `src/pages/admin/SpaManagement.tsx` — add `<TabsTrigger value="leave-review">Leave a Review</TabsTrigger>`
- `src/components/portal/PortalSidebar.tsx` — add "Reviews" nav item
- `src/App.tsx` (or portal route file) — register `/portal/reviews` route
- `src/hooks/useSpaReviews.ts` — extend `usePendingSpaReviews` to optionally accept an appointment id for deep-link

**Send link format:** `https://stormwellnessclub.com/portal/reviews?appointment=<id>` (uses primary domain per project memory).

**Send channels:** reuse existing transactional email function (one-off "Rate your treatment" template) and existing Twilio SMS edge function. SMS body short with link; email matches neutral "The Storm Wellness Club Team" voice.

### Out of scope
- Admin submitting reviews on behalf of clients
- Automated post-treatment email nudges (drip)
- Public display changes — `/spa` Reviews tab unchanged
