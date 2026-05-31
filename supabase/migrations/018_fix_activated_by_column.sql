-- ============================================
-- Fix activated_by column type
-- Changes from UUID to TEXT to support email-based user IDs
-- ============================================

-- First drop the policy that depends on the column
DROP POLICY IF EXISTS "Users can view their own activated codes" ON suite_codes;

-- Change column type from UUID to TEXT
ALTER TABLE suite_codes 
ALTER COLUMN activated_by TYPE TEXT;

-- Recreate the RLS policy to work with text-based user IDs
CREATE POLICY "Users can view their own activated codes" 
    ON suite_codes FOR SELECT 
    USING (activated_by = auth.jwt() ->> 'email' OR activated_by = auth.uid()::text);
