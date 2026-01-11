-- Webhook Idempotency Migration
-- Creates table to track processed Stripe webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE, -- Stripe event ID
  event_type TEXT NOT NULL, -- Stripe event type (e.g., 'checkout.session.completed')
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_result TEXT, -- 'success', 'error', 'skipped'
  error_message TEXT, -- Error message if processing failed
  metadata JSONB -- Additional event metadata for debugging
);

-- Disable RLS (table only accessed via service role in edge functions)
ALTER TABLE public.processed_webhook_events DISABLE ROW LEVEL SECURITY;

-- Create index on event_id for fast lookups
CREATE INDEX idx_processed_webhook_events_event_id ON public.processed_webhook_events(event_id);

-- Create index on processed_at for cleanup queries
CREATE INDEX idx_processed_webhook_events_processed_at ON public.processed_webhook_events(processed_at DESC);
