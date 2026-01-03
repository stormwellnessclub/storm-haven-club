-- Add stripe_customer_id column to membership_applications table
ALTER TABLE public.membership_applications 
ADD COLUMN stripe_customer_id text;