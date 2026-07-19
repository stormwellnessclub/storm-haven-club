ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS what_to_bring text;