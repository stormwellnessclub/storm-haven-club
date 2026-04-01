ALTER TABLE public.members ADD COLUMN IF NOT EXISTS pending_tier_change text DEFAULT NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS pending_tier_change_at timestamptz DEFAULT NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS pending_tier_change_by uuid DEFAULT NULL;