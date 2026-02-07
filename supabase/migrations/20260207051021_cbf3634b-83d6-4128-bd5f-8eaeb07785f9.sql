-- Add new columns to guest_passes table for enhanced guest experience
ALTER TABLE public.guest_passes 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS valid_date date,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS member_referral text,
ADD COLUMN IF NOT EXISTS visit_interests text[],
ADD COLUMN IF NOT EXISTS visit_notes text,
ADD COLUMN IF NOT EXISTS add_ons jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add index for querying by valid_date
CREATE INDEX IF NOT EXISTS idx_guest_passes_valid_date ON public.guest_passes(valid_date);

-- Add index for querying by user_id
CREATE INDEX IF NOT EXISTS idx_guest_passes_user_id ON public.guest_passes(user_id);

-- Update RLS policy to allow authenticated users to insert their own guest passes
CREATE POLICY "Users can insert their own guest passes"
ON public.guest_passes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to view their own guest passes
CREATE POLICY "Users can view their own guest passes"
ON public.guest_passes
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR sold_by IS NOT NULL);