

# Fix: Program Generation Failing Due to split_type Constraint

## Root Cause

The `workout_programs` table has a check constraint allowing only: `full_body`, `upper_lower`, `push_pull_legs`, `bro_split`.

The AI model sometimes returns other values like `"custom"` — which causes the insert to fail with error code `23514`.

There's also a secondary issue: the AI sometimes returns malformed JSON (seen in logs: `SyntaxError: Expected ',' or '}' after property value in JSON at position 49354`).

## Fix

### 1. Update the database constraint to add `custom` as an allowed value
Add a migration to drop and recreate the check constraint with `custom` added.

### 2. Sanitize split_type in the edge function before insert
In `supabase/functions/ai-recommendations/index.ts` (around line 487), validate `programJson.split_type` against the allowed list and fall back to the input `splitType` (from preferences) if the AI returns something invalid.

### 3. Add JSON parsing resilience
The edge function already strips markdown code fences, but should also handle trailing commas and other common AI JSON errors before `JSON.parse`.

### Files
- **Migration**: Add `custom` to the `workout_programs_split_type_check` constraint
- **Modify**: `supabase/functions/ai-recommendations/index.ts` — sanitize `split_type` before DB insert, improve JSON parsing robustness

