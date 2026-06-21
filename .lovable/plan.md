## Goal
Surface the AI Workout Generator inside the mobile **Activity** tab (`/member/check-in-history`) so members can generate a workout without leaving the activity view.

## Changes
**File: `src/pages/member/CheckInHistory.tsx`**
1. Import `GenerateWorkoutModal` from `@/components/member/GenerateWorkoutModal` and `Sparkles` icon.
2. Add local state `showWorkoutModal`.
3. In the header action area (next to the existing "Log Amenity" button), add a primary "Generate Workout" button that opens the modal.
4. Render `<GenerateWorkoutModal open={showWorkoutModal} onOpenChange={setShowWorkoutModal} />` at the bottom alongside the existing `LogAmenityDialog`.

No routing changes, no business logic changes — purely surfacing the existing generator on the Activity page. The standalone Workouts page (`/member/workouts`) keeps its own generator unchanged.

## Notes
- Same modal already in use on the Workouts page, so behavior/state is consistent.
- Button stacks below "Log Amenity" on small screens via existing flex layout.
