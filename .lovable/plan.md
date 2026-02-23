

## Remaining Fix: Equipment Images in Program Workout Cards

### What Was Missed

The `ProgramWorkoutCard` component (used to display exercises inside generated workout programs) was never updated to show equipment images. Currently, exercises in programs render as simple text rows with no images, even though:

- The `ExerciseCard` component already supports an `imageUrl` prop
- The `useEquipmentImages` hook and `findEquipmentImage` function exist and work
- AI Workout exercises already display images correctly

This means members viewing their 4-week program never see equipment images, even though the same images show up fine in the AI Workouts tab.

### Changes

#### 1. Update ProgramWorkoutCard to show equipment images
**File:** `src/components/member/ProgramWorkoutCard.tsx`

- Add an `equipmentImages` prop (type `EquipmentImageMap`)
- Replace the plain text exercise rows with the existing `ExerciseCard` component, or add inline image rendering using `findEquipmentImage`
- Using `ExerciseCard` directly would be ideal since it already handles image display, error fallback, body part badges, and collapsible instructions

#### 2. Pass equipment images from ProgramDashboard
**File:** `src/components/member/ProgramDashboard.tsx`

- Import `useEquipmentImages` and `findEquipmentImage`
- Call `useEquipmentImages()` to get the cached image map
- Pass `equipmentImages` prop to each `ProgramWorkoutCard`

### Files to Modify

| File | Change |
|------|--------|
| `src/components/member/ProgramWorkoutCard.tsx` | Accept `equipmentImages` prop; use `ExerciseCard` or inline images for each exercise |
| `src/components/member/ProgramDashboard.tsx` | Import and call `useEquipmentImages()`; pass image data to `ProgramWorkoutCard` |

### No Other Missing Items

Everything else from the original plan was implemented correctly:
- Error handling in the generator hook
- Past programs history with reactivate
- Equipment image hook and fuzzy matching
- ExerciseCard image rendering
- Edge function payload optimization
- Storage bucket creation

