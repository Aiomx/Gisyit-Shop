-- ============================================
-- Admin RLS Policies for CDK Management
-- This migration adds full access policies for CDK tables
-- to allow admin dashboard to manage CDK inventory
-- ============================================

-- ============================================
-- STEP 1: Drop existing restrictive policies on CDK tables
-- ============================================
DROP POLICY IF EXISTS "Users can view delivered codes for their paid orders" ON cdk_codes;

-- ============================================
-- STEP 2: Create full access policies for CDK tables
-- (For development/admin - the store-frontend uses server-side access)
-- ============================================

-- CDK Codes: Full access for admin management
CREATE POLICY "CDK codes full access" ON cdk_codes 
    FOR ALL USING (true) WITH CHECK (true);

-- CDK Import Batches: Full access for admin management
CREATE POLICY "CDK import batches full access" ON cdk_import_batches 
    FOR ALL USING (true) WITH CHECK (true);

-- CDK Audit Logs: Full access for admin viewing
CREATE POLICY "CDK audit logs full access" ON cdk_audit_logs 
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Note: In production, you should restrict these policies
-- to authenticated admin users only. Example:
-- 
-- CREATE POLICY "CDK codes admin access" ON cdk_codes 
--     FOR ALL USING (
--         auth.uid() IN (SELECT user_id FROM admin_users)
--     ) WITH CHECK (
--         auth.uid() IN (SELECT user_id FROM admin_users)
--     );
-- ============================================

