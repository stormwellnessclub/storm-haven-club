## Mobile UX & state-preservation overhaul (Workouts, Class Booking, Kids Care)

After a full audit of `src/pages/member/Workouts.tsx`, `src/pages/Schedule.tsx`, `src/components/booking/BookingModal.tsx`, `src/components/booking/KidsCareBookingModal.tsx`, `src/components/member/GenerateWorkoutModal.tsx`, `src/components/member/GenerateProgramModal.tsx`, and `src/components/member/WorkoutBuilder.tsx`, here are the four root causes — each with a targeted, non-rushed fix.

### Root causes (what's actually broken)

1. **Sideways scroll on Workouts page** — the "Logged" tab renders a 6-column `<Table>` with `<TableHead>` for Date / Type / Duration / Calories / Exercises / Actions. There is no horizontal scroll wrapper and no mobile card alternative, so iPhone users have to drag the whole page sideways.
2. **Workouts page header overflows** — the title row stacks `Log Workout`, `Build Custom Workout`, `Generate AI Workout` (or `Create Fitness Profile`) into a single non-wrapping `flex gap-2` next to the heading. On 375 px wide screens that pushes content past the viewport.
3. **Every multi-step modal resets on any dismissal** — `GenerateWorkoutModal` and `GenerateProgramModal` wire `Dialog.onOpenChange={resetAndClose}`, and `resetAndClose` always wipes `step` back to 1 plus clears all preferences. So tapping outside the modal, swiping the iOS overlay, or any auto-dismissal wipes their work. `BookingModal`, `WorkoutBuilder`, and `KidsCareBookingModal` reset their state on close in a similar way (form-level state is React-only and never persisted).
4. **Screen lock / app backgrounding loses state entirely** — none of these flows write to `sessionStorage` or `localStorage`. iOS Safari aggressively reclaims memory for tabs that go background, so even keeping the modal "open" is not enough; when the user returns the page is re-mounted and they're back at step 1.

### Plan (sequential, deliberate)

#### Phase 1 — Mobile responsiveness on `/member/workouts`

a. **Header bar refactor**: change the header `<div className="flex items-center justify-between">` block (lines ~253–395) to:
   - Stack the title above the action buttons on `< sm` (`flex-col sm:flex-row sm:items-center sm:justify-between gap-3`).
   - Make the action button row `flex flex-wrap gap-2 w-full sm:w-auto` so buttons wrap instead of overflowing.
   - On mobile only, collapse the three action buttons into a single primary `Log Workout` button + a "More options" dropdown (`DropdownMenu`) that contains `Build Custom Workout` and `Generate AI Workout`. On `sm+` keep the three-button layout.

b. **Logged workouts list — replace table with mobile cards**:
   - Wrap the existing `<Table>` in `<div className="hidden md:block">` so desktop keeps its dense grid.
   - Add a parallel `<div className="md:hidden space-y-2">` that renders each workout as a compact `Card` with date + type on row 1, duration/calories/exercise count on row 2, and edit/delete icon buttons on row 3 (icon-sm size, right-aligned).
   - This is the same data, just stacked vertically — eliminates the sideways scroll.

c. **AI Workouts tab grid**: the `grid gap-3 md:grid-cols-2` for `<ExerciseCard>` is fine, but the parent `Card` paddings (`CardHeader`, `CardContent`) need `px-4 sm:px-6` and the action buttons row inside (`Mark Complete`, `Delete`) should become `flex-wrap gap-2`.

d. **Tabs strip** (`Programs / Templates / Logged / AI Workouts`): on iPhone the four pills overflow. Wrap the `<TabsList>` in `<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">` so the tabs scroll independently without forcing the whole page sideways. Keep desktop unchanged.

#### Phase 2 — Persistent state for the AI Workout & Program generation flows

Create a tiny, reusable hook `src/hooks/usePersistedState.ts`:

```text
usePersistedState<T>(key: string, initial: T): [T, setter, clearer]
- reads from sessionStorage on mount
- writes on every change (debounced via useEffect)
- clearer wipes the key (call this on successful submission or explicit Cancel)
```

Apply it in:
- `GenerateWorkoutModal.tsx`: replace the local `useState` for `step` and `preferences` with `usePersistedState("workouts.generate.v1", ...)`. **Stop resetting on every close.** Change `Dialog onOpenChange` from `resetAndClose` to plain `onOpenChange` so dismissing the modal preserves state. Only call the clearer inside `onGenerate` success and from a new explicit `Reset` button next to `Back` on step 1.
- `GenerateProgramModal.tsx`: same treatment with key `"workouts.generateProgram.v1"`.

Add a "Resume your in-progress workout setup" hint at the top of `Workouts.tsx`: when sessionStorage has a non-empty key, show a subtle banner ("You have an unfinished AI workout — Continue / Discard"). Tapping Continue re-opens the corresponding modal; the modal's persisted state automatically restores them at the right step with the right selections.

#### Phase 3 — Persistent state for class booking

In `src/components/booking/BookingModal.tsx`:
- Persist `paymentMethod`, `selectedPassId`, `showWaiverInline`, `waiverAcknowledged` keyed by `"booking.session.<sessionId>.v1"`. Use a `useEffect` that loads when `session?.id` changes.
- Remove the unconditional reset in the `useEffect` at line 100–105 (it currently zeroes inline-waiver state on close). Replace with: only clear when booking succeeds (after `bookClass.mutateAsync`), or when the user explicitly hits Cancel.
- Persist the **selected session id** in `sessionStorage("booking.lastSession")` from `Schedule.tsx` `setSelectedSession`, and on Schedule page mount, if the saved id matches a still-loaded session and `bookingOpen` is false, render an inline "Resume booking for {className}?" toast/CTA. Tap → re-opens `BookingModal` with the same session and persisted form state intact.
- When the modal closes via backdrop tap, do NOT clear state — only the explicit `Cancel` button clears.

#### Phase 4 — Persistent state for Kids Care booking

In `src/components/booking/KidsCareBookingModal.tsx` apply the same pattern:
- Persist all fields (`selectedDate`, `selectedStartTime`, `selectedEndTime`, `selectedChildId`, `selectedPassId`, `specialInstructions`, `parentNotes`) in `usePersistedState("kidsCare.booking.v1", {...})`. Use `JSON.stringify` for `selectedDate` since it's a `Date` object — serialize as ISO and revive on load.
- Don't reset on `onOpenChange(false)`. Only reset after a successful confirmation (the existing flow already shows the `confirmedBooking` screen — that's where the clearer goes).
- Add a "You have an unfinished Kids Care booking" inline pill on `/member/kids-care` and `/member/kids-care-bookings` that re-opens the modal pre-filled.

#### Phase 5 — Mobile sizing for the modals themselves

For each of: `BookingModal`, `KidsCareBookingModal`, `GenerateWorkoutModal`, `GenerateProgramModal`, `WorkoutBuilder`:
- Change `DialogContent` className to include `w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-...` so on iPhone they always fit, with 8 px gutters left/right.
- Add `max-h-[100dvh] sm:max-h-[90vh]` (use dynamic viewport height units to avoid iOS Safari URL-bar cropping the bottom buttons).
- Footer button rows that currently use `flex justify-end` switch to `flex flex-col-reverse sm:flex-row sm:justify-end gap-2` so the primary CTA is always at the bottom on mobile (thumb-reachable) and the Cancel button is above it.
- In `WorkoutBuilder.tsx`, change the `grid grid-cols-4` for sets/reps/weight/rest (line ~194) to `grid grid-cols-2 sm:grid-cols-4` so on iPhone the fields stack 2x2 instead of being squeezed below tap-target size.

#### Phase 6 — QA pass

After Phase 1–5 land, manually verify on a 375×812 viewport (iPhone X size):
- Workouts page: no horizontal scroll on any tab.
- Open `Generate AI Workout`, advance to step 3, tap outside → reopen → must resume on step 3 with selections intact.
- Open `Book a Class` from `/schedule`, choose pass payment, tap outside → reopen via "Resume booking" CTA → state intact.
- Open `Kids Care booking`, fill date/time/child, lock screen, unlock → reopen modal → state intact.
- All confirm/cancel buttons reachable without scrolling on iPhone SE width (375 px).

### Files touched (summary)

- `src/hooks/usePersistedState.ts` — new
- `src/pages/member/Workouts.tsx` — header refactor, mobile cards for logged tab, scrollable tabs
- `src/components/member/GenerateWorkoutModal.tsx` — persistent state, no-reset-on-dismiss
- `src/components/member/GenerateProgramModal.tsx` — same
- `src/components/booking/BookingModal.tsx` — persistent state, mobile sizing, footer reflow
- `src/components/booking/KidsCareBookingModal.tsx` — same
- `src/components/member/WorkoutBuilder.tsx` — mobile sizing, grid-cols-2 fields
- `src/pages/Schedule.tsx` — "Resume booking" inline CTA
- `src/pages/member/KidsCare.tsx` and `src/pages/member/KidsCareBookings.tsx` — "Resume booking" inline CTA

No database, RLS, or edge function changes. Pure frontend.

### What this does NOT include (out of scope on purpose)

- Replacing modals with full-screen pages or routed flows. That's a bigger refactor and would risk regressions in the rest of the portal — the persistence-based fix solves the actual user complaint (lost state) without restructuring routing.
- Native mobile (Capacitor) work. Everything here is web-PWA, which is what's currently shipped.

I'll execute Phase 1 → 6 in order, and pause between phases to let you sanity-check the visuals before moving on.