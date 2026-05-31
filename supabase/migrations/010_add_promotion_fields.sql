-- ============================================
-- Add promotion fields to products table
-- ============================================

-- Add promotion-related columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_start_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_end_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_price DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promotion_unlimited BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN products.promotion_start_at IS '促销开始时间';
COMMENT ON COLUMN products.promotion_end_at IS '促销结束时间（null表示无限期）';
COMMENT ON COLUMN products.promotion_price IS '促销价格';
COMMENT ON COLUMN products.original_price IS '原价（促销结束后恢复）';
COMMENT ON COLUMN products.is_promotion_unlimited IS '是否无限期促销';

-- ============================================
-- Add user status field to profiles table
-- ============================================

-- Create user status enum type
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'banned', 'violation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN profiles.status IS '用户状态: active=活跃, banned=封禁, violation=违规';
COMMENT ON COLUMN profiles.status_reason IS '状态变更原因';
COMMENT ON COLUMN profiles.status_updated_at IS '状态变更时间';

-- ============================================
-- Create anonymous_sessions table for guest users
-- ============================================

CREATE TABLE IF NOT EXISTS anonymous_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    order_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0
);

-- Add index for session lookup
CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_session_id ON anonymous_sessions(session_id);

-- Add comment
COMMENT ON TABLE anonymous_sessions IS '游客会话记录表';

-- ============================================
-- Function to auto-restore original price after promotion ends
-- ============================================

CREATE OR REPLACE FUNCTION check_promotion_expiry()
RETURNS void AS $$
BEGIN
    -- Update products where promotion has ended
    UPDATE products
    SET 
        has_discount = false,
        promotion_price = NULL,
        promotion_start_at = NULL,
        promotion_end_at = NULL,
        is_promotion_unlimited = false
    WHERE 
        has_discount = true 
        AND is_promotion_unlimited = false
        AND promotion_end_at IS NOT NULL 
        AND promotion_end_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to check promotion expiry (requires pg_cron extension)
-- Note: This needs to be run by Supabase admin or via Edge Function cron
-- SELECT cron.schedule('check-promotion-expiry', '*/5 * * * *', 'SELECT check_promotion_expiry()');
