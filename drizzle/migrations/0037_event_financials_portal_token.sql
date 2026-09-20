ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS event_financials_portal_token_uniq ON public.event_financials(portal_token);
ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS portal_viewed_at timestamptz;
ALTER TABLE public.event_financials ADD COLUMN IF NOT EXISTS reminder_offsets integer[] NOT NULL DEFAULT ARRAY[-7,0,3,10];