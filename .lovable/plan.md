

## Plan: Spa Client Intake Form

### Goal
Let members fill out a focus-areas intake form when booking spa services (especially massage/body work). Therapists see it before/during the appointment.

### 1. Database (new migration)

**New table `spa_intake_forms`** — one row per appointment (or per member, reusable):
- `id` uuid PK
- `appointment_id` uuid FK → `spa_appointments(id)` ON DELETE CASCADE, unique
- `member_id`, `user_id` uuid (denormalized for RLS lookup)
- `focus_areas` text[] — selected body zones (e.g. `neck`, `shoulders`, `lower_back`, `hips`, `glutes`, `hamstrings`, `calves`, `feet`, `upper_back`, `arms`, `head_scalp`)
- `pressure_preference` text — `light` | `medium` | `firm` | `deep`
- `pain_level` int (0–10)
- `pain_areas` text — free text describing pain/injuries
- `health_conditions` text[] — checklist (pregnancy, high BP, recent surgery, allergies, skin conditions, diabetes, heart, blood thinners, other)
- `allergies` text — free text
- `medications` text — free text
- `goals` text — what they want from the session
- `areas_to_avoid` text — free text
- `prior_massage_experience` text — `none` | `occasional` | `regular`
- `consent_signed` boolean default false
- `consent_signed_at` timestamptz
- `created_at`, `updated_at`

**RLS:**
- Users can insert/update/select their own (`auth.uid() = user_id`)
- Staff (`spa_staff`, `admin`, `manager`, `super_admin`, `front_desk`) can select all; spa_staff can update notes
- Trigger to auto-set `updated_at`

**Mark services that need intake:**
- Update `spa_services.requires_intake_form = true` for all Massage and Wrap services (everything in massage/body categories). Facials and Red Light = optional.

### 2. UI: Member booking flow

**New component**: `src/components/spa/SpaIntakeForm.tsx`
- Body diagram with clickable zones (simple SVG front/back outline, toggle highlight per zone) OR grid of checkbox cards if SVG is overkill
- Pressure slider (Light → Deep)
- Pain level slider (0–10)
- Health conditions checklist (multi-select chips)
- Free-text fields (allergies, meds, goals, avoid areas, pain description)
- Consent checkbox: "I confirm the above is accurate and consent to treatment"
- Zod validation, client + server

**Booking integration** (`src/components/booking/SpaBookingModal.tsx`):
- After confirming time/therapist/payment, if `service.requires_intake_form === true`, push a new step "Intake Form" before final confirm
- On submit: insert appointment first, then insert intake form with `appointment_id`
- If user skips a required intake → block submit with toast

**Existing appointments without intake**:
- Add "Complete Intake Form" button in `src/pages/member/Bookings.tsx` Spa tab for upcoming appointments where `requires_intake_form && !intake_form_exists`
- Show "Intake submitted ✓" when complete

### 3. UI: Admin / therapist view

**`src/components/admin/spa/SpaCompletionDialog.tsx`** + therapist schedule view:
- New "Intake Form" section showing all answers in read-only summary card
- "Not submitted" empty state with copy-link button to send intake to member

**`src/components/admin/spa/AdminSpaBookingModal.tsx`**:
- Same optional intake step when admin books on behalf of a member; can also defer ("send link to member")

### 4. Hook

**`src/hooks/useSpaIntake.ts`**:
- `useIntakeForm(appointmentId)` — fetch
- `useSubmitIntakeForm()` — insert/update mutation
- `useHasIntakeForm(appointmentId)` — boolean for badges

### 5. Files to create / change

**New**
- DB migration (table + RLS + trigger + service flag updates)
- `src/components/spa/SpaIntakeForm.tsx`
- `src/components/spa/IntakeFormSummary.tsx` (read-only display)
- `src/hooks/useSpaIntake.ts`

**Modified**
- `src/components/booking/SpaBookingModal.tsx` — intake step
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — intake step + send-link
- `src/components/admin/spa/SpaCompletionDialog.tsx` — show intake summary
- `src/pages/member/Bookings.tsx` — "Complete Intake" CTA + status badge

### Open question
Body-area selection style: do you want a **clickable body diagram (SVG)** or a simpler **grid of zone checkboxes** (faster to ship, mobile-friendly)? Defaulting to checkbox grid unless you say otherwise.

