## Spa Reviews Feature

Mirror the existing class reviews system for spa appointments. Anyone who completed a massage/treatment can leave a star rating + optional comment, and a public "Reviews" tab on the Spa page shows aggregate ratings and recent reviews.

**Privacy:** Reviewer names are always displayed as `First L.` (first name + first letter of last name, e.g. "Sarah M.") — never the full last name. This is enforced server-side in the RPC, not just the UI.

### 1. Database (`spa_reviews` table)

Mirrors `class_reviews`:
- `appointment_id` (FK → `spa_appointments`, unique → one review per appointment)
- `service_id` (FK → `spa_services`)
- `therapist_id` (FK → `spa_therapists`, nullable)
- `user_id` (auth user) + `reviewer_name` (snapshot of full name; private)
- `rating` (1–5), `review_text`
- `is_visible` (admin can hide)
- timestamps

RLS:
- INSERT: only the user who owns the appointment, and only if `status = 'completed'`
- UPDATE: own review (rating/text), or admin (visibility)
- SELECT public: only `is_visible = true`
- SELECT admin: all
- DELETE: admin only

RPCs:
- `get_spa_reviews_with_names(service_id, include_hidden)` — returns reviewer name **already abbreviated** as `First L.` (split on first space, take first char of remainder + "."). Admins receive the full name when `include_hidden=true` and they have the admin role.
- `get_all_spa_service_ratings()` — returns `{service_id, avg_rating, count}` for badges/cards
- `get_pending_spa_reviews(user_id)` — completed appointments without a review (for portal nudge)

### 2. Member-facing review entry

- New banner on **portal Bookings / Recovery / spa appointment history**: "Rate your recent treatment" — opens a dialog (reuse `ReviewDialog` pattern from class reviews, adapted to spa).
- Trigger appears once `spa_appointments.status = 'completed'` and no review exists.

### 3. Spa page Reviews tab (public)

Add a top-level tab/segmented control on `/spa`:
- **Services** (current view)
- **Reviews** (new)

Reviews tab shows:
- Overall club rating (avg of all visible) + total count
- Filter by service category (Massage, Facials, etc.) and by individual service
- List of recent reviews — reviewer shown as `First L.`, stars, date, text, service name
- Each service card on the Services tab also gets a small star + count badge linking into the Reviews tab filtered to that service.

### 4. Admin

New `Reviews` tab in **Admin → Spa Management**:
- Table of all reviews with filter by service/therapist/visibility
- Admins see full reviewer name (for moderation/support)
- Hide / Unhide toggle, delete (super-admin)

### 5. Files

**New**
- `supabase/migrations/<ts>_spa_reviews.sql` — table + RLS + RPCs (with name abbreviation logic)
- `src/hooks/useSpaReviews.ts`
- `src/components/spa/SpaReviewDialog.tsx`
- `src/components/spa/SpaReviewsList.tsx`
- `src/components/spa/SpaReviewsTab.tsx`
- `src/components/admin/spa/SpaReviewsAdminTab.tsx`
- `src/components/spa/LeaveSpaReviewBanner.tsx`

**Edited**
- `src/pages/Spa.tsx` — Services / Reviews segmented control
- `src/pages/admin/SpaManagement.tsx` — add Reviews tab
- `src/pages/portal/Recovery.tsx` and/or `portal/Bookings.tsx` — mount review banner

### Out of scope
- Post-treatment email nudges
