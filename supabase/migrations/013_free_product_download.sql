-- ============================================
-- Free Product Download Migration
-- Adds free product fields and download_logs table
-- Requirements: 1.1, 6.3, 8.1
-- ============================================

-- ============================================
-- Add free product fields to products table
-- ============================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_login BOOLEAN DEFAULT false;

-- ============================================
-- Download Logs Table
-- Tracks free product downloads (separate from orders)
-- ============================================
CREATE TABLE IF NOT EXISTS download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(100),
    ip_address INET,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure at least one identifier is present
    CONSTRAINT download_logs_user_or_session 
        CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- ============================================
-- Indexes for download_logs
-- ============================================
CREATE INDEX IF NOT EXISTS idx_download_logs_product ON download_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_user ON download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_session ON download_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_time ON download_logs(downloaded_at);

-- ============================================
-- RLS Policies for download_logs
-- ============================================
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view all download logs" ON download_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Users can view their own logs
CREATE POLICY "Users can view their own download logs" ON download_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Server can insert logs (via service role)
CREATE POLICY "Server can insert download logs" ON download_logs
    FOR INSERT WITH CHECK (true);
