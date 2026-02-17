

# Remove Equipment Selection from Fitness Profile

## Problem
The Fitness Profile schema still contains `available_equipment` and `equipment_ids` fields. While the checkboxes were removed from the UI, the fields remain in the form schema, hook types, and default values. The AI program/workout generators already fetch **all active equipment** directly from the database (lines 202-208 and 276-280 in the edge function), so these profile fields serve no purpose and create confusion.

## Changes

### 1. Clean up `src/pages/member/FitnessProfile.tsx`
- Remove `available_equipment` and `equipment_ids` from the Zod schema
- Remove them from `defaultValues` and `form.reset()` call
- Remove `equipment_ids` from `onSubmit` logic
- Remove `"available_equipment" | "equipment_ids"` from `toggleArrayItem` function signature

### 2. Clean up `src/hooks/useFitnessProfile.ts`
- Remove `available_equipment` and `equipment_ids` from `FitnessProfile` and `FitnessProfileInput` interfaces
- Remove `available_equipment` and `equipment_ids` from insert/update data objects

### 3. No edge function changes needed
The `ai-recommendations` edge function already fetches all active equipment directly from the `equipment` table for both workout and program generation. The equipment list in the AI prompt is correct -- it shows all club equipment so the AI can reference it when designing workouts. This is backend context for the AI, not something members need to interact with.

## What This Does NOT Change
- The AI prompt still receives the full equipment list (this is correct behavior -- the AI needs to know what machines exist to reference them in workouts)
- The `equipment` database table remains unchanged
- The `member_fitness_profiles` table columns remain (no migration needed -- they just won't be populated going forward)
