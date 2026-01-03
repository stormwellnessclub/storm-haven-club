-- Add locked_start_date column to members table
-- When set by admin, member cannot choose their own start date during activation
ALTER TABLE public.members 
ADD COLUMN locked_start_date date;

COMMENT ON COLUMN public.members.locked_start_date IS 
'When set by admin, member cannot choose their start date during activation - it is fixed';