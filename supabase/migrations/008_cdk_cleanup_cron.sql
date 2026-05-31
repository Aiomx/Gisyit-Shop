-- CDK Cleanup Cron Jobs Migration
-- 
-- Sets up scheduled cleanup jobs for CDK inventory management.
-- - Timeout cleanup: Every 5 minutes (releases reservations older than 15 minutes)
-- - Orphan cleanup: Every hour (releases codes with no valid order)
--
-- Requirements: 6.1, 6.5, 6.6
--
-- Prerequisites:
-- 1. pg_cron extension must be enabled
-- 2. pg_net extension must be enabled (for HTTP calls)
-- 3. Edge Function must be deployed: supabase functions deploy cdk-cleanup
--
-- Note: Replace <PROJECT_REF> with your Supabase project reference
-- and <ANON_KEY> with your project's anon key.

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- Option 1: Using Edge Function (Recommended)
-- ============================================
-- Uncomment and configure the following after deploying the Edge Function

-- Schedule timeout cleanup every 5 minutes
-- SELECT cron.schedule(
--   'cdk-timeout-cleanup',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <ANON_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{"action": "timeout"}'::jsonb
--   )
--   $$
-- );

-- Schedule orphan cleanup every hour
-- SELECT cron.schedule(
--   'cdk-orphan-cleanup',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <ANON_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{"action": "orphan"}'::jsonb
--   )
--   $$
-- );

-- ============================================
-- Option 2: Using Database Functions (Alternative)
-- ============================================
-- If Edge Functions are not available, use these database functions directly

-- Function to release timeout reservations
CREATE OR REPLACE FUNCTION release_timeout_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  timeout_threshold TIMESTAMPTZ;
  released_count INTEGER := 0;
  cancelled_orders TEXT[] := ARRAY[]::TEXT[];
  order_record RECORD;
BEGIN
  -- Calculate timeout threshold (15 minutes ago)
  timeout_threshold := NOW() - INTERVAL '15 minutes';
  
  -- Find and process timed out reservations grouped by order
  FOR order_record IN
    SELECT DISTINCT order_id
    FROM cdk_codes
    WHERE status = 'reserved'
      AND reserved_at < timeout_threshold
      AND order_id IS NOT NULL
  LOOP
    -- Release codes for this order
    WITH released AS (
      UPDATE cdk_codes
      SET 
        status = 'available',
        order_id = NULL,
        reserved_at = NULL,
        updated_at = NOW()
      WHERE order_id = order_record.order_id
        AND status = 'reserved'
      RETURNING id
    )
    SELECT COUNT(*) INTO released_count FROM released;
    
    -- Create audit log entries
    INSERT INTO cdk_audit_logs (cdk_code_id, action, old_status, new_status, order_id, actor_type, reason, created_at)
    SELECT 
      id,
      'released',
      'reserved',
      'available',
      order_record.order_id,
      'system',
      'payment_timeout',
      NOW()
    FROM cdk_codes
    WHERE order_id IS NULL 
      AND status = 'available'
      AND updated_at >= NOW() - INTERVAL '1 second';
    
    -- Cancel the order
    UPDATE orders
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = order_record.order_id
      AND status = 'pending';
    
    IF FOUND THEN
      cancelled_orders := array_append(cancelled_orders, order_record.order_id::TEXT);
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'released_count', released_count,
    'cancelled_orders', cancelled_orders,
    'timestamp', NOW()
  );
END;
$$;

-- Function to cleanup orphan reservations
CREATE OR REPLACE FUNCTION cleanup_orphan_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  released_count INTEGER := 0;
  orphan_code_ids UUID[];
BEGIN
  -- Find orphan codes (reserved but order doesn't exist or is in terminal state)
  SELECT ARRAY_AGG(c.id) INTO orphan_code_ids
  FROM cdk_codes c
  LEFT JOIN orders o ON c.order_id = o.id
  WHERE c.status = 'reserved'
    AND c.order_id IS NOT NULL
    AND (o.id IS NULL OR o.status NOT IN ('pending', 'paid'));
  
  IF orphan_code_ids IS NULL OR array_length(orphan_code_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'released_count', 0,
      'timestamp', NOW()
    );
  END IF;
  
  -- Release orphan codes
  WITH released AS (
    UPDATE cdk_codes
    SET 
      status = 'available',
      order_id = NULL,
      reserved_at = NULL,
      updated_at = NOW()
    WHERE id = ANY(orphan_code_ids)
      AND status = 'reserved'
    RETURNING id
  )
  SELECT COUNT(*) INTO released_count FROM released;
  
  -- Create audit log entries
  INSERT INTO cdk_audit_logs (cdk_code_id, action, old_status, new_status, actor_type, reason, created_at)
  SELECT 
    unnest(orphan_code_ids),
    'released',
    'reserved',
    'available',
    'system',
    'orphan_cleanup',
    NOW();
  
  RETURN jsonb_build_object(
    'released_count', released_count,
    'timestamp', NOW()
  );
END;
$$;

-- Schedule database functions with pg_cron (Alternative to Edge Functions)
-- Uncomment these if using Option 2

-- Schedule timeout cleanup every 5 minutes
-- SELECT cron.schedule(
--   'cdk-timeout-cleanup-db',
--   '*/5 * * * *',
--   'SELECT release_timeout_reservations()'
-- );

-- Schedule orphan cleanup every hour
-- SELECT cron.schedule(
--   'cdk-orphan-cleanup-db',
--   '0 * * * *',
--   'SELECT cleanup_orphan_reservations()'
-- );

-- ============================================
-- Utility: View scheduled jobs
-- ============================================
-- SELECT * FROM cron.job;

-- ============================================
-- Utility: Unschedule jobs
-- ============================================
-- SELECT cron.unschedule('cdk-timeout-cleanup');
-- SELECT cron.unschedule('cdk-orphan-cleanup');
-- SELECT cron.unschedule('cdk-timeout-cleanup-db');
-- SELECT cron.unschedule('cdk-orphan-cleanup-db');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION release_timeout_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_orphan_reservations() TO service_role;

COMMENT ON FUNCTION release_timeout_reservations() IS 'Releases CDK codes reserved for more than 15 minutes and cancels associated pending orders. Requirements: 6.1, 6.5';
COMMENT ON FUNCTION cleanup_orphan_reservations() IS 'Releases CDK codes with no valid associated order. Requirement: 6.6';
