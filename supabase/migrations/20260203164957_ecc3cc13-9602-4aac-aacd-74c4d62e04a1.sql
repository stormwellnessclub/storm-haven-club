-- Add column to track when payment links are sent to applicants
ALTER TABLE public.membership_applications 
ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ DEFAULT NULL;