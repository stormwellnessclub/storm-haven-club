# AI Workout System Enhancement Plan

## Overview
Two major enhancements:
1. Update equipment database to match your actual gym inventory
2. Add 4-week progressive workout program generation

---

## Part 1: Equipment Database Update

### Current Equipment in Database (37 items)
Review this list and specify which to KEEP, REMOVE, or ADD:

**Cardio (7 items):**
- Technogym Skillrun
- Technogym Skillrow
- Technogym Skillbike
- Technogym Excite Run
- Technogym Excite Bike
- Technogym Synchro (cross-trainer)
- Technogym Climb (stair climber)

**Machines (need to see full list):**
- Technogym Chest Press
- Technogym Lat Pulldown
- Technogym Leg Press
- Technogym Leg Extension
- Technogym Leg Curl
- Booty Builder Hip Thrust
- Booty Builder Glute Kickback
- (and more...)

**Free Weights:**
- Dumbbells (5-100 lbs)
- Olympic Barbells
- EZ Curl Bars
- Kettlebells (10-100 lbs)
- Weight Plates
- Power Rack
- Flat/Incline/Decline Benches
- Preacher Curl Bench

**Functional:**
- Technogym Kinesis
- Cable Crossover Station
- Technogym Dual Adjustable Pulley
- TRX Suspension Trainer
- Battle Ropes
- Plyo Boxes

**Accessories:**
- Resistance Bands
- Medicine Balls
- Yoga Mats
- Ab Wheel

### Action Required
Provide a list of:
1. Equipment to REMOVE (don't have)
2. Equipment to ADD (missing from list)
3. Any name corrections needed

### Implementation
- Run DELETE statements for equipment to remove
- Run INSERT statements for new equipment
- Update existing equipment names if needed

---

## Part 2: 4-Week Progressive Program Generation

### Database Changes Required

**New Table: `workout_programs`**
```sql
CREATE TABLE workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) NOT NULL,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL, -- strength, hypertrophy, fat_loss, endurance
  duration_weeks INTEGER DEFAULT 4,
  days_per_week INTEGER DEFAULT 3,
  difficulty TEXT DEFAULT 'intermediate',
  target_body_parts TEXT[],
  progression_style TEXT, -- linear, undulating, block
  ai_reasoning TEXT,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage own programs" ON workout_programs
  FOR ALL USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
```

**New Table: `program_workouts`**
```sql
CREATE TABLE program_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES workout_programs(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL, -- 1-4
  day_number INTEGER NOT NULL, -- 1-7
  workout_name TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  exercises JSONB NOT NULL,
  duration_minutes INTEGER,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE program_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage own program workouts" ON program_workouts
  FOR ALL USING (program_id IN (
    SELECT id FROM workout_programs WHERE member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  ));
```

### UI Changes

**1. Update GenerateWorkoutModal**
Add a new initial step asking:
- "Single Workout" (current flow)
- "4-Week Program" (new flow)

For 4-week program, add additional options:
- Program Type: Strength Building, Muscle Building, Fat Loss, Endurance
- Days per Week: 2, 3, 4, 5, 6
- Progression Style: Linear (increase weight each week), Undulating (vary intensity), Block (focus phases)

**2. New Component: ProgramDashboard**
Display active program with:
- Week tabs (Week 1, Week 2, Week 3, Week 4)
- Daily workout cards showing exercises
- Progress tracking (completed workouts)
- Visual progress bar
- Ability to mark workouts complete

**3. Update Workouts Page**
Add tabs or sections for:
- "Single Workouts" (current AI workouts)
- "My Programs" (4-week programs)

### Edge Function Updates

**Modify `ai-recommendations/index.ts`**
Add new type: `program_generation`

When generating a 4-week program, AI will create:
- Progressive overload structure (increasing sets/reps/weight each week)
- Appropriate rest day distribution
- Exercise variety while maintaining consistency
- Deload week (week 4) with reduced volume

AI prompt structure for program generation:
- Week 1: Foundation (moderate intensity, learn movements)
- Week 2: Build (increase volume +10%)
- Week 3: Push (peak intensity +20%)
- Week 4: Deload (reduced volume for recovery)

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/member/GenerateWorkoutModal.tsx` | Modify | Add program vs single workout choice |
| `src/components/member/ProgramDashboard.tsx` | Create | Display and track 4-week programs |
| `src/components/member/ProgramWorkoutCard.tsx` | Create | Individual workout card within program |
| `src/pages/member/Workouts.tsx` | Modify | Add Programs tab/section |
| `src/hooks/useWorkoutPrograms.ts` | Create | CRUD hooks for programs |
| `supabase/functions/ai-recommendations/index.ts` | Modify | Add program_generation type |

### User Flow for Program Generation

1. Member clicks "Generate AI Workout"
2. Modal asks: "Single Workout" or "4-Week Program"
3. If Program selected:
   - Select program goal (Strength, Hypertrophy, Fat Loss, Endurance)
   - Select target body parts (or Full Body split)
   - Select days per week (2-6)
   - Select intensity level
4. AI generates complete 4-week program with progressive structure
5. Program saved to database
6. Member sees program dashboard with all workouts laid out by week
7. Member can mark individual workouts complete
8. Progress tracked visually

---

## Implementation Order

1. **Phase 1**: Update equipment database (user provides list)
2. **Phase 2**: Create new database tables for programs
3. **Phase 3**: Create ProgramDashboard and related components
4. **Phase 4**: Update GenerateWorkoutModal with program option
5. **Phase 5**: Update edge function for program generation
6. **Phase 6**: Update Workouts page to show programs

---

## Critical Files for Implementation

- `src/components/member/GenerateWorkoutModal.tsx` - Add program/single workout choice and program options
- `supabase/functions/ai-recommendations/index.ts` - Add program_generation logic with progressive overload
- `src/pages/member/Workouts.tsx` - Add Programs section with tabs
- New: `src/components/member/ProgramDashboard.tsx` - Main program view with week navigation
- New: `src/hooks/useWorkoutPrograms.ts` - React Query hooks for program CRUD operations
