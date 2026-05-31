-- ============================================
-- Suite Code Management Table
-- Creates table for SUITE Studio activation codes
-- Requirements: 2.1, 2.2, 2.3
-- ============================================

-- Suite Codes Table
CREATE TABLE IF NOT EXISTS suite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('membership', 'credits')),
    membership_tier VARCHAR(10) CHECK (
        (code_type = 'membership' AND membership_tier IN ('plus', 'pro', 'ultra')) OR
        (code_type = 'credits' AND membership_tier IS NULL)
    ),
    credits_amount INTEGER CHECK (
        (code_type = 'credits' AND credits_amount >= 100) OR
        (code_type = 'membership' AND credits_amount IS NULL)
    ),
    membership_days INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired', 'disabled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    activated_by TEXT,
    activation_ip VARCHAR(45),
    activation_device TEXT,
    batch_id UUID,
    notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suite_codes_code ON suite_codes(code);
CREATE INDEX IF NOT EXISTS idx_suite_codes_status ON suite_codes(status);
CREATE INDEX IF NOT EXISTS idx_suite_codes_type ON suite_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_suite_codes_expires ON suite_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_suite_codes_batch ON suite_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_suite_codes_created ON suite_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_suite_codes_activated_by ON suite_codes(activated_by);

-- RLS Policies (drop first to make idempotent)
ALTER TABLE suite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suite codes admin full access" ON suite_codes;
CREATE POLICY "Suite codes admin full access" 
    ON suite_codes FOR ALL 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own activated codes" ON suite_codes;
CREATE POLICY "Users can view their own activated codes" 
    ON suite_codes FOR SELECT 
    USING (activated_by = auth.uid());

-- Function to auto-expire codes (using $BODY$ dollar-quoting)
CREATE OR REPLACE FUNCTION update_expired_suite_codes()
RETURNS void AS $BODY$
BEGIN
    UPDATE suite_codes
    SET status = 'expired'
    WHERE status = 'unused'
    AND expires_at < NOW();
END;
$BODY$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE suite_codes IS 'SUITE Studio 激活码管理表';
COMMENT ON COLUMN suite_codes.code IS '激活码字符串，格式: {PREFIX}-{4CHARS}-{4CHARS}';
COMMENT ON COLUMN suite_codes.code_type IS '激活码类型: membership (会员) 或 credits (积分)';
COMMENT ON COLUMN suite_codes.membership_tier IS '会员等级: plus, pro, ultra';
COMMENT ON COLUMN suite_codes.credits_amount IS '积分数量，最小值 100';
COMMENT ON COLUMN suite_codes.membership_days IS '会员有效天数';
COMMENT ON COLUMN suite_codes.status IS '状态: unused, used, expired, disabled';
COMMENT ON COLUMN suite_codes.expires_at IS '激活码过期时间';
COMMENT ON COLUMN suite_codes.activated_by IS '激活用户 ID';
COMMENT ON COLUMN suite_codes.activation_ip IS '激活时的 IP 地址';
COMMENT ON COLUMN suite_codes.activation_device IS '激活时的设备信息';
COMMENT ON COLUMN suite_codes.batch_id IS '批次 ID，用于追踪批量生成的激活码';
