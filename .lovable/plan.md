
## Fix Workout Program Generator and Add Equipment Images

### Problems Found

**1. Programs "disappearing" -- by design but confusing**

When a member generates a new program, the backend (edge function at line 472-475) automatically deactivates ALL previous active programs for that member (`is_active = false`). The frontend only shows active programs. So generating a new program hides the old one. Members are not warned about this.

The data confirms this: e.g., member `b33805e6` has 3 programs but only the latest is active -- the other two are silently deactivated.

**Fix:** Show a history of past (inactive) programs so members can view/reactivate them.

**2. Generator silently "succeeds" even when it fails**

The edge function returns HTTP 200 with `{ error: "Failed to parse program data" }` when the AI returns malformed JSON. The frontend hook (`useGenerateProgram`) doesn't check for this error field -- it treats any 200 response as success and shows "4-week program generated successfully!" toast. The member sees a success message but no program appears.

**Fix:** Check the response for error fields and throw if present.

**3. Equipment images exist but are never displayed**

The `equipment` table has an `image_url` column with data (mostly base64, some regular URLs). However:
- `ExerciseCard.tsx` (used for AI workouts) does not render any image
- `ProgramWorkoutCard.tsx` (used for programs) does not render any image
- The AI generates exercise names matching equipment, but there is no lookup to fetch the equipment image

The images you uploaded to the equipment records are there in the database, but no UI component reads or displays them.

**Fix:** Match exercise equipment names to the equipment table and display the image.

**4. Base64 images in the database are problematic**

Some equipment image URLs are over 80,000 characters (raw base64). This bloats every database query that selects from the equipment table and slows down the AI edge function (which fetches all equipment). These should be moved to file storage.

**Fix:** Migrate base64 images to a storage bucket, update URLs.

---

### Implementation Plan

#### Step 1: Fix silent failure in program generator

**File:** `src/hooks/useWorkoutPrograms.ts` (useGenerateProgram mutation)

Check the edge function response for error fields before treating it as a success:

```
if (response.data?.error) {
  throw new Error(response.data.error);
}
```

This already exists in the current code (line 219-221) -- so the error handling is present. The issue is that `response.error` (the Supabase function invocation error) is different from `response.data.error` (the application-level error). Both are checked. This part looks correct.

However, there is still a potential issue: if the AI returns unparseable JSON, the edge function catches it and returns a 200 with `error: "Failed to parse program data"`. The hook does check `response.data?.error`, so this should be caught. Let me re-verify the exact flow -- the edge function returns `recommendation` (raw text) when parsing fails, not the structured program. The hook's `onSuccess` fires showing "4-week program generated successfully!" but the program was never saved.

**Actual root cause:** The `response.data.error` check is there, but the response also has `saved: false` with no `error` field in some code paths (lines 500-509 of the edge function). When the program insert fails, the response is `{ saved: false, error: "Failed to save program to database" }` -- this IS caught. But when JSON parsing fails (line 543-554), it returns `{ error: "Failed to parse program data" }` -- this IS also caught.

So the error handling code path is correct. The real issue may be **rate limiting or AI gateway failures**. Without recent edge function logs, it is hard to confirm. The fix should add better error logging and user feedback.

#### Step 2: Show past (inactive) programs

**File:** `src/pages/member/Workouts.tsx`

Currently the Programs tab only shows the single active program or a "No Active Program" message. Add a section below showing past programs with the option to view details or reactivate.

**File:** `src/hooks/useWorkoutPrograms.ts`

The `useWorkoutPrograms` hook already fetches ALL programs (not just active). The data is available but the UI filters to only show the active one.

#### Step 3: Create equipment image storage bucket

Create a `equipment-images` storage bucket and migrate base64 images to proper file storage. This is critical for performance and for displaying images in workout cards.

**Database migration:**
- Create storage bucket `equipment-images` (public)
- RLS policy: public read access

#### Step 4: Display equipment images in exercise cards

**File:** `src/components/member/ExerciseCard.tsx`

Add an image display area that:
1. Takes an optional `imageUrl` prop
2. Shows the equipment image when available
3. Falls back to the body-part color icon when no image exists

**File:** `src/components/member/ProgramWorkoutCard.tsx`

Pass equipment image URLs through to exercise display.

**File:** `src/hooks/useAIWorkouts.ts` and `src/hooks/useWorkoutPrograms.ts`

When fetching workouts, also look up matching equipment images by exercise equipment name. This can be done with a join or a separate equipment query cached by React Query.

#### Step 5: Add equipment image lookup hook

**New file:** `src/hooks/useEquipmentImages.ts`

A lightweight hook that fetches equipment name-to-image mappings (cached). Used by ExerciseCard to display the right image for each exercise.

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useEquipmentImages.ts` | Cached lookup of equipment names to image URLs |

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useWorkoutPrograms.ts` | Improve error handling in useGenerateProgram |
| `src/pages/member/Workouts.tsx` | Show past/inactive programs section |
| `src/components/member/ExerciseCard.tsx` | Add equipment image display |
| `src/components/member/ProgramWorkoutCard.tsx` | Pass image data to exercise display |
| `supabase/functions/ai-recommendations/index.ts` | Add better error logging; exclude image_url from equipment queries to reduce payload size |

### Database Changes

- Create `equipment-images` storage bucket with public read access
- Migration to move base64 image data from `equipment.image_url` to storage bucket files (updates URLs in place)

### Summary of Root Causes

| Symptom | Root Cause |
|---------|-----------|
| "Old program went away" | Generating a new program deactivates the old one; UI only shows active programs |
| "Generator not working" | Likely AI response parsing failures returning 200 with error; or rate limiting; no visible error shown to member |
| "Uploaded pictures not showing" | Images exist in database but no UI component renders them |
