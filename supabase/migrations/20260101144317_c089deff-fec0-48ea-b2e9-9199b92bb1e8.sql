-- Add columns for deferred activation flow
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS activation_deadline timestamptz,
ADD COLUMN IF NOT EXISTS activated_at timestamptz;