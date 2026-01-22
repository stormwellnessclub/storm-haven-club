-- =====================================================
-- Migration 6: processed_webhook_events (webhook idempotency)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_result TEXT,
  error_message TEXT,
  metadata JSONB
);

-- Disable RLS (table only accessed via service role in edge functions)
ALTER TABLE public.processed_webhook_events DISABLE ROW LEVEL SECURITY;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON public.processed_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at ON public.processed_webhook_events(processed_at DESC);

COMMENT ON TABLE public.processed_webhook_events IS 'Tracks processed Stripe webhook events to prevent duplicate processing.';