ALTER TABLE public.pending_non_member_imports 
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz DEFAULT NULL;