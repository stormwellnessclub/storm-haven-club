

## Clean Up Duplicate Equipment Entries

### Problem
There are **32 equipment items** that each have an exact duplicate (same name, both active). This means the AI workout generator sees each of these listed twice in its prompt, wasting tokens and potentially skewing exercise selection.

### Impact on Workout Generator
- The equipment list sent to the AI model is ~30% bloated
- The AI may over-weight duplicated equipment in generated workouts
- Wastes AI input tokens on every generation request

### Fix

**Database cleanup** -- For each of the 32 duplicated names, keep the older entry (original) and soft-delete the newer one by setting `is_active = false`. If only one of the two has an image, keep the one with the image instead.

This is a data-only change (no code modifications needed). The existing queries already filter by `is_active = true`, so deactivated duplicates will automatically disappear from the AI prompt and the UI.

### Equipment Affected (32 duplicates to remove)

- Booty Builder Belt Squat Machine, Hack Squat Machine, Loaded Back Extension, Platinum V4, Station One V2, V8.0
- CardioGym CG6
- Curl Barbells, Straight Barbells
- Flat Bench Chest Press, Pilates Ab Ball
- Technogym BioStrength Abductor, Leg Curl, Leg Extension
- Technogym Cable Stations 4 Evolution
- Technogym Climb Live, Excite Live Run, Synchro AR
- Technogym Kinesis Core Station, Personal Heritage, Step/Squat Station
- Technogym Multi Power Smith, Power Rack
- Technogym Pure Strength Hip Thrust
- Technogym Selection 700 (Abductor/Adductor, Pectoral/Reverse Fly, Leg Raise/Dip, Lower Back, Vertical Traction)
- Technogym Selection 900 Pulley, Arm Tricep Extension
- Technogym Skillrun 500

### Technical Details

A single SQL update will deactivate the newer duplicate for each pair:

```sql
-- For each duplicate name, keep the row with the earliest created_at 
-- (or the one with an image if only one has one), deactivate the other
UPDATE equipment 
SET is_active = false, updated_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT id, name, 
      ROW_NUMBER() OVER (
        PARTITION BY name 
        ORDER BY (image_url IS NOT NULL) DESC, created_at ASC
      ) as rn
    FROM equipment 
    WHERE is_active = true
  ) ranked 
  WHERE rn > 1
);
```

This keeps the best copy (prefers one with image, then oldest) and deactivates the rest.

### No Code Changes Needed

All queries already filter on `is_active = true`, so deactivated duplicates will automatically stop appearing in:
- AI workout generation prompts
- Equipment image lookups
- Admin equipment lists
