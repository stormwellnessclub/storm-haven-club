-- Enable RLS on scheduled_functions_config (internal config table, no direct access needed)
ALTER TABLE public.scheduled_functions_config ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE policies needed - only accessed via SECURITY DEFINER function

-- Fix function search paths for security
ALTER FUNCTION public.get_scheduled_functions_config() SET search_path = public;
ALTER FUNCTION public.process_member_scan(TEXT, UUID, BOOLEAN, TEXT, BOOLEAN, TEXT) SET search_path = public;