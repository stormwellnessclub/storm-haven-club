-- Update class_category enum to support 3 studios: reformer, cycling, aerobics
-- This migration changes from: pilates_cycling, other
-- To: reformer, cycling, aerobics

-- First, update existing records
-- Map 'pilates_cycling' to 'reformer' (all reformer pilates classes)
-- Map 'other' to 'aerobics' (all other classes)

UPDATE class_types 
SET category = 'reformer'::text::class_category 
WHERE category = 'pilates_cycling';

-- Note: We can't update 'other' to 'aerobics' directly because the new enum doesn't exist yet
-- We'll need to temporarily set them to NULL or use a workaround
-- Since we're changing the enum, we'll need to drop and recreate it

-- Step 1: Create new enum type
CREATE TYPE class_category_new AS ENUM ('reformer', 'cycling', 'aerobics');

-- Step 2: Update the column to use text temporarily
ALTER TABLE class_types 
  ALTER COLUMN category TYPE text USING category::text;

-- Step 3: Map old values to new values
UPDATE class_types 
SET category = CASE 
  WHEN category = 'pilates_cycling' THEN 'reformer'
  WHEN category = 'other' THEN 'aerobics'
  ELSE 'aerobics'  -- Default fallback
END;

-- Step 4: Drop old enum and constraints
ALTER TABLE class_types DROP CONSTRAINT IF EXISTS class_types_category_check;
DROP TYPE IF EXISTS class_category;

-- Step 5: Rename new enum
ALTER TYPE class_category_new RENAME TO class_category;

-- Step 6: Update column to use new enum
ALTER TABLE class_types 
  ALTER COLUMN category TYPE class_category USING category::class_category;

-- Step 7: Update other tables that reference class_category enum
-- Check if class_sessions table uses this enum
DO $$
BEGIN
  -- Update class_sessions if it has a category column (check first)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_sessions' AND column_name = 'category'
  ) THEN
    ALTER TABLE class_sessions 
      ALTER COLUMN category TYPE text USING category::text;
    
    UPDATE class_sessions 
    SET category = CASE 
      WHEN category = 'pilates_cycling' THEN 'reformer'
      WHEN category = 'other' THEN 'aerobics'
      ELSE 'aerobics'
    END;
    
    ALTER TABLE class_sessions 
      ALTER COLUMN category TYPE class_category USING category::class_category;
  END IF;
END $$;

-- Update class_passes table if it uses category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_passes' AND column_name = 'category'
  ) THEN
    ALTER TABLE class_passes 
      ALTER COLUMN category TYPE text USING category::text;
    
    UPDATE class_passes 
    SET category = CASE 
      WHEN category = 'pilates_cycling' THEN 'reformer'
      WHEN category = 'other' THEN 'aerobics'
      ELSE 'aerobics'
    END;
    
    ALTER TABLE class_passes 
      ALTER COLUMN category TYPE class_category USING category::class_category;
  END IF;
END $$;

