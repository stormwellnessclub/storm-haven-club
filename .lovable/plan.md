

# Custom Muscle Split Builder for 4-Week Program

## What Changes

Replace the current Step 3 (split type) and Step 4 (optional body part tags) with a smarter flow:

**Step 3 stays** — but when the user picks **"Body Part Split"** or a new **"Custom Split"** option, the flow adds **Step 4: Day-by-Day Muscle Assignment**.

**New Step 4: Assign Muscles to Each Day**
- Shows a card for each training day (based on `daysPerWeek` from Step 2)
- Each day card has multi-select muscle group buttons (Glutes, Back, Core/Abs, Chest, Shoulders, Arms, Legs/Quads, Hamstrings, Calves)
- Users can assign the same muscle to multiple days (e.g., Glutes on 3 of 4 days)
- A summary shows the split at a glance: "Day 1: Glutes, Back · Day 2: Glutes, Core · ..."
- If the user picks a predefined split (PPL, Upper/Lower, Full Body), Step 4 becomes optional emphasis picks (current behavior)

**Step 5 becomes the old Step 4** (optional emphasis/notes) only for predefined splits. For custom splits, Step 4 replaces it entirely.

### Data Changes

Update `ProgramPreferences` interface to include:
```typescript
export interface ProgramPreferences {
  programType: string;
  daysPerWeek: number;
  durationWeeks: number;
  splitType: string;
  targetBodyParts: string[];
  customSplit?: { day: number; muscles: string[] }[]; // NEW
}
```

### Edge Function Prompt Update

When `customSplit` is provided, inject it into the AI prompt so the AI knows exactly which muscles to program on which day:
```
CUSTOM SPLIT ASSIGNMENT:
- Day 1: Glutes, Back
- Day 2: Glutes, Core/Abs
- Day 3: Glutes, Shoulders
- Day 4: Core/Abs, Arms
```

### Files

- **Modify**: `src/components/member/GenerateProgramModal.tsx` — Add custom split step with day-by-day muscle assignment UI, expand body parts list (add Hamstrings, Quads, Calves separately), update step logic
- **Modify**: `src/hooks/useWorkoutPrograms.ts` — Update `ProgramPreferences` interface to include `customSplit`
- **Modify**: `supabase/functions/ai-recommendations/index.ts` — Read `customSplit` from preferences and inject day-by-day muscle assignments into the AI prompt

