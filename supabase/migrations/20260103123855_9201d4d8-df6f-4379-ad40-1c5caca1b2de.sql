-- Add column to track when annual fee was paid (for pre-collected fees before activation)
ALTER TABLE public.members 
ADD COLUMN annual_fee_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.members.annual_fee_paid_at IS 'Timestamp when annual fee was paid (e.g., via manual charge before activation)';