-- Add Stripe billing columns to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS annual_fee_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add index for faster lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer_id ON public.members(stripe_customer_id);

-- Add comment for documentation
COMMENT ON COLUMN public.members.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.members.stripe_subscription_id IS 'Stripe subscription ID for monthly/annual membership';
COMMENT ON COLUMN public.members.annual_fee_subscription_id IS 'Stripe subscription ID for yearly recurring annual fee';
COMMENT ON COLUMN public.members.billing_type IS 'monthly or annual (for founding members)';
COMMENT ON COLUMN public.members.is_founding_member IS 'True if member paid annual membership upfront';
COMMENT ON COLUMN public.members.gender IS 'female or male - used for pricing determination';