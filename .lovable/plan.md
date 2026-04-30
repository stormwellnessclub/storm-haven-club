# Resume Mobile UX & Persistence Overhaul

Phases 1 and 2a are done (Workouts page mobile-optimized, AI Generator persists across dismissals). This plan covers the remaining phases.

## Phase 2b — Persist Program Generator
**File:** `src/components/member/GenerateProgramModal.tsx`
- Replace `useState` for `step` and `preferences` with `usePersistedState` (key: `program-gen`).
- Remove auto-reset on dismiss; add explicit "Start over" button.
- Clear persisted state only on successful program creation.

## Phase 3 — Class Booking Flow Persistence + Resume
**Files:** `src/pages/Schedule.tsx`, `src/pages/Classes.tsx`, booking modal/sheet components, `src/pages/member/Bookings.tsx`, `src/pages/portal/Bookings.tsx`
- Persist class booking draft (selected session id, attendee info, waiver state, payment step) in `sessionStorage` keyed by user.
- If user dismisses the booking sheet mid-flow, do **not** reset — re-opening any class returns to the same step for that session.
- Add a dismissible **"Resume booking"** banner at top of `/schedule`, member Bookings, and portal Bookings when a draft exists. Tapping it reopens the sheet at the saved step.
- Auto-clear draft on successful booking, explicit cancel, or after 60 minutes.

## Phase 4 — Kids Care Booking Flow Persistence + Resume
**Files:** `src/pages/member/KidsCare.tsx`, `src/pages/member/KidsCareServiceForm.tsx`, `src/pages/member/KidsCareBookings.tsx`
- Same pattern as Phase 3: persist child selection, date/time, hours, payment step.
- Resume CTA on `/member/kids-care` and `/member/kids-care/bookings`.
- Clear on success or explicit cancel.

## Phase 5 — Mobile Sizing Pass for Heavy Modals
**Files:** `src/components/member/WorkoutBuilder.tsx`, class booking sheet, kids-care service form, any 4-column grid modals
- Convert `DialogContent` to use `w-[calc(100vw-1rem)] max-w-[640px] max-h-[100dvh] overflow-y-auto` on mobile.
- Replace 4-column exercise/option grids with 2-column on mobile, 4 on `md:`.
- Ensure all primary CTAs are sticky-bottom on mobile (`sticky bottom-0 bg-background pt-3 pb-[env(safe-area-inset-bottom)]`).
- Bump touch targets to `min-h-[44px]`.
- Wrap any horizontal tab/filter rows in `overflow-x-auto` with hidden scrollbar.

## Phase 6 — Verification
- Manually QA on iPhone Safari at 390x844: open each flow, dismiss mid-step, reopen → confirm step is preserved and Resume banner appears.
- Confirm modals fit viewport without horizontal scrolling.

## Technical Notes
- Reuse existing `src/hooks/usePersistedState.ts`. For booking drafts that need a TTL, add a sibling `usePersistedDraft<T>(key, ttlMs)` that stores `{value, savedAt}` and auto-expires.
- Resume banner = small shared component `<ResumeBookingBanner kind="class" | "kids-care" />` reading from the same storage keys.
- All keys namespaced per-user: `swc:${userId}:class-booking-draft`, etc., to avoid cross-account leakage.

## Out of Scope
- No changes to backend RPCs or RLS.
- No new Stripe flows; existing payment steps are simply re-entered at the saved index.
