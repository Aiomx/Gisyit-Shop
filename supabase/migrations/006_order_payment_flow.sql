-- Migration: Order Payment Flow Enhancement
-- Requirements: 2.4, 3.1, 5.3
-- 
-- This migration adds support for:
-- - Pending orders with 15-minute payment window
-- - Anonymous user checkout via session_id
-- - Payment completion tracking

-- ============================================
-- Update orders table
-- ============================================

-- Add expires_at column for payment window tracking
-- Calculated as created_at + 15 minutes when order is created
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add payment_completed_at to track when payment was successful
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add anonymous_session_id for guest checkout support
-- Either user_id or anonymous_session_id must be set
ALTER TABLE orders ADD COLUMN IF NOT EXISTS anonymous_session_id TEXT;

-- Make user_id nullable to support anonymous orders
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Update status check constraint to include "pending" as valid initial state
-- Drop existing constraint and recreate with updated values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'created', 'pending_payment', 'paid', 'fulfilled', 'completed', 'cancelled'));

-- Add check constraint to ensure either user_id or anonymous_session_id is set
ALTER TABLE orders ADD CONSTRAINT orders_user_identification_check
    CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL);

-- ============================================
-- Indexes for new columns
-- ============================================

-- Index for querying orders by anonymous session
CREATE INDEX IF NOT EXISTS idx_orders_anonymous_session ON orders(anonymous_session_id) WHERE anonymous_session_id IS NOT NULL;

-- Index for finding expired pending orders
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at) WHERE status = 'pending';

-- ============================================
-- Update RLS Policies for anonymous orders
-- ============================================

-- Drop existing order policies
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;

-- Create new policy: Users can view orders by user_id OR anonymous_session_id
-- Note: anonymous_session_id check requires server-side validation
CREATE POLICY "Users can view their own orders" ON orders 
    FOR SELECT USING (
        auth.uid() = user_id 
        OR (user_id IS NULL AND anonymous_session_id IS NOT NULL)
    );

-- Order items policy follows order access
CREATE POLICY "Users can view their own order items" ON order_items 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND (
                orders.user_id = auth.uid() 
                OR (orders.user_id IS NULL AND orders.anonymous_session_id IS NOT NULL)
            )
        )
    );

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON COLUMN orders.expires_at IS 'Payment deadline timestamp. Order auto-cancels if not paid by this time. Set to created_at + 15 minutes.';
COMMENT ON COLUMN orders.payment_completed_at IS 'Timestamp when payment was successfully completed via Stripe webhook.';
COMMENT ON COLUMN orders.anonymous_session_id IS 'Session identifier for guest checkout. Used when user_id is null.';
