-- Migration: Create stripe_events table for webhook idempotency
-- Requirements: 10.1, 10.2, 10.3
-- 
-- This table tracks processed Stripe webhook events to prevent duplicate processing.
-- Each event.id from Stripe is stored to ensure idempotent webhook handling.
--
-- To apply this migration, run in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS stripe_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL UNIQUE,  -- Stripe event.id (e.g., 'evt_1234567890')
    event_type text NOT NULL,       -- Stripe event type (e.g., 'payment_intent.succeeded')
    processed_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb                   -- Optional: full event payload for debugging
);

-- Index for fast lookup by event_id
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);

-- Index for querying by event type (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type ON stripe_events(event_type);

-- Comment on table
COMMENT ON TABLE stripe_events IS 'Tracks processed Stripe webhook events for idempotent handling';
COMMENT ON COLUMN stripe_events.event_id IS 'Unique Stripe event ID (e.g., evt_xxx)';
COMMENT ON COLUMN stripe_events.event_type IS 'Stripe event type (e.g., payment_intent.succeeded)';
COMMENT ON COLUMN stripe_events.processed_at IS 'Timestamp when the event was processed';
COMMENT ON COLUMN stripe_events.payload IS 'Optional full event payload for debugging';
