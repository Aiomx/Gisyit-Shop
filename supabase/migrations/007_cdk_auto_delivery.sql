-- Migration: CDK Auto-Delivery System
-- Requirements: 1.6, 2.1, 3.1, 3.2, 3.3, 3.4, 6.4, 8.4, 9.4
-- 
-- This migration adds support for:
-- - CDK codes inventory management
-- - Import batch tracking
-- - Audit logging for status changes
-- - CDK pattern validation on products

-- ============================================
-- 1.1 CDK Codes Table
-- Requirements: 3.1, 3.2, 3.3, 3.4
-- ============================================
CREATE TABLE IF NOT EXISTS cdk_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    code_hash TEXT NOT NULL,  -- SHA256 hash for deduplication
    status TEXT NOT NULL DEFAULT 'available' 
        CHECK (status IN ('available', 'reserved', 'delivered', 'invalid')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    reserved_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    import_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure code uniqueness via hash
    UNIQUE(code_hash)
);

-- Index for querying available codes by product
CREATE INDEX IF NOT EXISTS idx_cdk_codes_product_status 
    ON cdk_codes(product_id, status);

-- Index for querying codes by order
CREATE INDEX IF NOT EXISTS idx_cdk_codes_order 
    ON cdk_codes(order_id) WHERE order_id IS NOT NULL;

-- Index for finding reserved codes that may have timed out
CREATE INDEX IF NOT EXISTS idx_cdk_codes_reserved_timeout 
    ON cdk_codes(reserved_at) WHERE status = 'reserved';

-- Index for import batch queries
CREATE INDEX IF NOT EXISTS idx_cdk_codes_import_batch 
    ON cdk_codes(import_batch_id) WHERE import_batch_id IS NOT NULL;

COMMENT ON TABLE cdk_codes IS 'CDK codes inventory for virtual product auto-delivery';
COMMENT ON COLUMN cdk_codes.code_hash IS 'SHA256 hash of code for deduplication without exposing actual codes in indexes';
COMMENT ON COLUMN cdk_codes.status IS 'available: ready for sale, reserved: locked for pending order, delivered: sent to customer, invalid: manually disabled';
COMMENT ON COLUMN cdk_codes.reserved_at IS 'Timestamp when code was reserved, used for timeout cleanup';


-- ============================================
-- 1.2 CDK Import Batches Table
-- Requirements: 1.6, 8.4
-- ============================================
CREATE TABLE IF NOT EXISTS cdk_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    admin_id UUID NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'xlsx', 'text')),
    total_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    duplicate_count INTEGER NOT NULL,
    invalid_count INTEGER NOT NULL,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying import history by product
CREATE INDEX IF NOT EXISTS idx_cdk_import_batches_product 
    ON cdk_import_batches(product_id);

-- Index for querying import history by admin
CREATE INDEX IF NOT EXISTS idx_cdk_import_batches_admin 
    ON cdk_import_batches(admin_id);

-- Index for recent imports
CREATE INDEX IF NOT EXISTS idx_cdk_import_batches_created 
    ON cdk_import_batches(created_at DESC);

-- Add foreign key from cdk_codes to import batches
ALTER TABLE cdk_codes 
    ADD CONSTRAINT fk_cdk_codes_import_batch 
    FOREIGN KEY (import_batch_id) REFERENCES cdk_import_batches(id) ON DELETE SET NULL;

COMMENT ON TABLE cdk_import_batches IS 'Tracks CDK code import operations for audit and history';
COMMENT ON COLUMN cdk_import_batches.error_details IS 'JSON array of {line, code, reason} for failed imports';


-- ============================================
-- 1.3 CDK Audit Logs Table
-- Requirements: 6.4, 9.4
-- ============================================
CREATE TABLE IF NOT EXISTS cdk_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdk_code_id UUID NOT NULL REFERENCES cdk_codes(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'imported', 'reserved', 'delivered', 'released', 'invalidated'
    )),
    old_status TEXT,
    new_status TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    actor_id UUID,
    actor_type TEXT CHECK (actor_type IN ('system', 'admin', 'webhook')),
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit logs by CDK code
CREATE INDEX IF NOT EXISTS idx_cdk_audit_logs_code 
    ON cdk_audit_logs(cdk_code_id);

-- Index for querying audit logs by order
CREATE INDEX IF NOT EXISTS idx_cdk_audit_logs_order 
    ON cdk_audit_logs(order_id) WHERE order_id IS NOT NULL;

-- Index for querying audit logs by action type
CREATE INDEX IF NOT EXISTS idx_cdk_audit_logs_action 
    ON cdk_audit_logs(action);

-- Index for recent audit logs
CREATE INDEX IF NOT EXISTS idx_cdk_audit_logs_created 
    ON cdk_audit_logs(created_at DESC);

COMMENT ON TABLE cdk_audit_logs IS 'Audit trail for all CDK code status changes';
COMMENT ON COLUMN cdk_audit_logs.actor_type IS 'system: automated cleanup, admin: manual action, webhook: payment webhook';
COMMENT ON COLUMN cdk_audit_logs.reason IS 'Human-readable reason for the status change';
COMMENT ON COLUMN cdk_audit_logs.metadata IS 'Additional context data for the audit entry';


-- ============================================
-- 1.4 Extend Products Table for CDK Support
-- Requirements: 2.1
-- ============================================

-- Add cdk_pattern column for regex validation of CDK codes
-- Note: delivery_type column already exists with 'cdk' as valid value
ALTER TABLE products ADD COLUMN IF NOT EXISTS cdk_pattern TEXT;

COMMENT ON COLUMN products.cdk_pattern IS 'Regex pattern for validating CDK codes during import. NULL means accept any non-empty string.';

-- ============================================
-- RLS Policies for CDK Tables
-- ============================================

-- Enable RLS on all CDK tables
ALTER TABLE cdk_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdk_audit_logs ENABLE ROW LEVEL SECURITY;

-- CDK Codes: No direct client access (server-only via MCP)
-- Users can only see delivered codes for their own paid orders
CREATE POLICY "Users can view delivered codes for their paid orders" ON cdk_codes 
    FOR SELECT USING (
        status = 'delivered' 
        AND order_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = cdk_codes.order_id 
            AND orders.user_id = auth.uid()
            AND orders.status IN ('paid', 'fulfilled', 'completed')
        )
    );

-- CDK Import Batches: Admin only (no client access)
-- No SELECT policy for regular users

-- CDK Audit Logs: Admin only (no client access)
-- No SELECT policy for regular users

-- ============================================
-- Helper Function for CDK Code Hashing
-- ============================================
CREATE OR REPLACE FUNCTION generate_cdk_hash(code TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(code::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_cdk_hash IS 'Generates SHA256 hash for CDK code deduplication';


-- ============================================
-- RPC Function for Atomic CDK Reservation
-- Requirements: 4.1, 4.2, 4.4, 4.5
-- ============================================

/**
 * Atomically reserve CDK codes for an order
 * 
 * Uses FOR UPDATE SKIP LOCKED to prevent concurrent over-reservation.
 * Returns the reserved code IDs or raises an exception if insufficient inventory.
 *
 * @param p_product_id - The product ID to reserve codes for
 * @param p_quantity - Number of codes to reserve
 * @param p_order_id - The order ID to associate with reserved codes
 * @param p_reserved_at - The reservation timestamp
 * @returns Table of reserved code IDs
 */
CREATE OR REPLACE FUNCTION reserve_cdk_codes(
    p_product_id UUID,
    p_quantity INTEGER,
    p_order_id UUID,
    p_reserved_at TIMESTAMPTZ
)
RETURNS TABLE(id UUID) AS $$
DECLARE
    v_reserved_count INTEGER;
BEGIN
    -- Select and lock available codes atomically
    -- FOR UPDATE SKIP LOCKED ensures we don't wait for locked rows
    -- and don't reserve codes that are being reserved by another transaction
    WITH selected_codes AS (
        SELECT c.id
        FROM cdk_codes c
        WHERE c.product_id = p_product_id
          AND c.status = 'available'
        ORDER BY c.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_quantity
    ),
    updated_codes AS (
        UPDATE cdk_codes
        SET status = 'reserved',
            order_id = p_order_id,
            reserved_at = p_reserved_at,
            updated_at = p_reserved_at
        WHERE cdk_codes.id IN (SELECT selected_codes.id FROM selected_codes)
        RETURNING cdk_codes.id
    )
    SELECT COUNT(*) INTO v_reserved_count FROM updated_codes;

    -- Check if we reserved enough codes
    IF v_reserved_count < p_quantity THEN
        -- Rollback the partial reservation
        UPDATE cdk_codes
        SET status = 'available',
            order_id = NULL,
            reserved_at = NULL,
            updated_at = NOW()
        WHERE cdk_codes.order_id = p_order_id
          AND cdk_codes.status = 'reserved'
          AND cdk_codes.reserved_at = p_reserved_at;
        
        RAISE EXCEPTION 'insufficient inventory: requested %, available %', 
            p_quantity, v_reserved_count;
    END IF;

    -- Return the reserved code IDs
    RETURN QUERY
    SELECT c.id
    FROM cdk_codes c
    WHERE c.order_id = p_order_id
      AND c.status = 'reserved'
      AND c.reserved_at = p_reserved_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_cdk_codes IS 'Atomically reserve CDK codes for an order with FOR UPDATE SKIP LOCKED';
