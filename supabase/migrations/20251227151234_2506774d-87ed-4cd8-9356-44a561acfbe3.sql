-- Add annual_fee_status column to track $300 annual fee payment
ALTER TABLE public.membership_applications 
ADD COLUMN annual_fee_status text NOT NULL DEFAULT 'pending';

-- Add a comment to document the valid values
COMMENT ON COLUMN public.membership_applications.annual_fee_status IS 'Values: pending, paid, failed';