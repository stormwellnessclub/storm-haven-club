-- Add refund_notes column to manual_charges table
ALTER TABLE public.manual_charges 
ADD COLUMN refund_notes text,
ADD COLUMN refund_method text,
ADD COLUMN refunded_at timestamp with time zone,
ADD COLUMN refunded_by uuid;