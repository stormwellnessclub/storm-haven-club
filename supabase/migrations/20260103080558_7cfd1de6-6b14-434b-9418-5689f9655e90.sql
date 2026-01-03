-- Add first_name, last_name, and gender columns to membership_applications
ALTER TABLE public.membership_applications
ADD COLUMN first_name text,
ADD COLUMN last_name text,
ADD COLUMN gender text;

-- Migrate existing data: split full_name into first_name and last_name
UPDATE public.membership_applications
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END,
  gender = 'Women'
WHERE first_name IS NULL;

-- Now make the columns NOT NULL
ALTER TABLE public.membership_applications
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL,
ALTER COLUMN gender SET NOT NULL;