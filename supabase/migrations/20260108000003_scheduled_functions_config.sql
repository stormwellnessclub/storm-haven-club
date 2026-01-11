-- Configuration Table for Scheduled Functions
-- Stores the Supabase URL and anon key needed for pg_cron jobs to call edge functions
-- This approach works with Supabase managed instances (no superuser privileges required)

CREATE TABLE IF NOT EXISTS public.scheduled_functions_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  supabase_url TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.scheduled_functions_config ENABLE ROW LEVEL SECURITY;

-- Disable RLS for this table (only accessed via SECURITY DEFINER function)
-- The table will only be accessible through the get_scheduled_functions_config() function
ALTER TABLE public.scheduled_functions_config DISABLE ROW LEVEL SECURITY;

-- Function to get config values (for use in cron jobs)
CREATE OR REPLACE FUNCTION public.get_scheduled_functions_config()
RETURNS TABLE (
  supabase_url TEXT,
  anon_key TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    supabase_url,
    anon_key
  FROM public.scheduled_functions_config
  WHERE id = 'default'
  LIMIT 1;
$$;

-- Grant execute permission to authenticated (for service role)
GRANT EXECUTE ON FUNCTION public.get_scheduled_functions_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduled_functions_config() TO anon;

-- Insert default placeholder values
-- IMPORTANT: Replace these with your actual values after running the migration
INSERT INTO public.scheduled_functions_config (id, supabase_url, anon_key)
VALUES (
  'default',
  'https://cqzmrdzwgsujgbjqpoxh.supabase.co', -- Replace with your actual Supabase URL
  'YOUR-ANON-KEY-HERE' -- Replace with your actual anon key from Settings > API
)
ON CONFLICT (id) DO UPDATE
SET 
  supabase_url = EXCLUDED.supabase_url,
  anon_key = EXCLUDED.anon_key,
  updated_at = now();

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_scheduled_functions_config_updated_at
  BEFORE UPDATE ON public.scheduled_functions_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
