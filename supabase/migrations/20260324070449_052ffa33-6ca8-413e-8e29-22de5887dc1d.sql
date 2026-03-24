
-- Drop the old simple 1-param process_member_scan that bypasses billing checks
DROP FUNCTION IF EXISTS public.process_member_scan(text);
