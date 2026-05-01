# Finish Mobile UX & Persistence Overhaul — Phases 5 & 6

Phases 1–4 are done. This plan closes out the remaining work.

## Phase 5 — Mobile sizing pass for WorkoutBuilder

**File:** `src/components/member/WorkoutBuilder.tsx`

- `DialogContent`: change `sm:max-w-3xl max-h-[90vh]` → `w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6`.
- Per-exercise `grid grid-cols-4 gap-2` (Sets/Reps/Weight/Rest) → `grid grid-cols-2 md:grid-cols-4 gap-2` so the four numeric inputs don't get squashed on mobile.
- Bump exercise number inputs from `h-8` → `h-10` and Save/Log action buttons to `min-h-[44px]` for proper touch targets.
- Make the action row sticky on mobile: wrap the Save/Log buttons in `sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 pt-3 pb-[env(safe-area-inset-bottom)] bg-background border-t sm:border-0 sm:static`.

## Phase 6 — Kids Care resume banner + QA

**File:** `src/pages/member/KidsCare.tsx`
- Add `<ResumeBookingBanner kind="kids-care" onResume={...} />` near the top of the page content.
- On resume, navigate to `/member/kids-care/service` (or whichever entry the existing flow uses) — the form already reads its draft from `bookingDraft.ts` and will rehydrate.

**File:** `src/pages/member/KidsCareServiceForm.tsx` (verify only)
- Confirm it reads from `readKidsCareDraft()` on mount and calls `clearKidsCareDraft()` on successful submit. If not already wired (Phase 4 covered the modal, not the standalone form), add the same persistence hooks here using `usePersistedState` keyed off `swc:booking-draft:kids-care`.

**Verification at 390x844 (iPhone 12/13/14):**
- Workouts → AI Generator → set goal → close sheet → reopen: state preserved.
- Programs → AI Generator → close mid-step → reopen: state preserved, "Start over" works.
- Schedule → tap a class → pick payment → close sheet → schedule shows Resume banner → tap Resume → returns to same step.
- Kids Care → start booking → close → Resume banner shows on `/member/kids-care` and `/member/kids-care/bookings`.
- WorkoutBuilder: open on mobile, scroll, verify Save/Log buttons remain reachable, no horizontal overflow.

## Out of scope
- No backend, RPC, or RLS changes.
- No new payment flows — only re-entry into existing steps.
