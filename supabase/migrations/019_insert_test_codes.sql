-- ============================================
-- Insert test activation codes for development
-- ============================================

-- Insert test membership codes
INSERT INTO suite_codes (code, code_type, membership_tier, membership_days, status, expires_at, notes)
VALUES 
    ('SPLUS-TEST-0001', 'membership', 'plus', 30, 'unused', NOW() + INTERVAL '1 year', 'Test Plus membership code'),
    ('SPRO-TEST-0001', 'membership', 'pro', 30, 'unused', NOW() + INTERVAL '1 year', 'Test Pro membership code'),
    ('SULTRA-TEST-001', 'membership', 'ultra', 30, 'unused', NOW() + INTERVAL '1 year', 'Test Ultra membership code')
ON CONFLICT (code) DO NOTHING;

-- Insert test credits codes
INSERT INTO suite_codes (code, code_type, credits_amount, status, expires_at, notes)
VALUES 
    ('SCRED-TEST-0001', 'credits', 1000, 'unused', NOW() + INTERVAL '1 year', 'Test 1000 credits code'),
    ('SCRED-TEST-0002', 'credits', 5000, 'unused', NOW() + INTERVAL '1 year', 'Test 5000 credits code')
ON CONFLICT (code) DO NOTHING;
