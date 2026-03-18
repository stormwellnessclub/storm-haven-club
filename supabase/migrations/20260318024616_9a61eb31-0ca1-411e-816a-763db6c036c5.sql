ALTER TABLE public.pending_non_member_imports 
ADD COLUMN IF NOT EXISTS fulfilled_user_id uuid;