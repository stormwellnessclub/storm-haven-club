-- Add member_credit_id column to track which credit was used for booking
ALTER TABLE public.class_bookings 
ADD COLUMN member_credit_id UUID REFERENCES public.member_credits(id);