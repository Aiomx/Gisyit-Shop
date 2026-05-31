-- ============================================
-- Brand Management Tables
-- Creates tables for brands and product-brand associations
-- Requirements: 1.1, 1.6, 2.1, 2.4
-- ============================================

-- ============================================
-- Brands Table
-- ============================================
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    brand_group VARCHAR(50) NOT NULL DEFAULT 'platform',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Product-Brand Association Table
-- ============================================
CREATE TABLE IF NOT EXISTS product_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, brand_id)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_group ON brands(brand_group);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_sort ON brands(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_brands_product ON product_brands(product_id);
CREATE INDEX IF NOT EXISTS idx_product_brands_brand ON product_brands(brand_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_brands ENABLE ROW LEVEL SECURITY;

-- Brands: Public read for active brands only
CREATE POLICY "Active brands are viewable by everyone" 
    ON brands FOR SELECT 
    USING (is_active = true);

-- Brands: Admin full access (for dashboard management)
CREATE POLICY "Brands admin full access" 
    ON brands FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Product-Brands: Public read
CREATE POLICY "Product brands are viewable by everyone" 
    ON product_brands FOR SELECT 
    USING (true);

-- Product-Brands: Admin full access
CREATE POLICY "Product brands admin full access" 
    ON product_brands FOR ALL 
    USING (true) 
    WITH CHECK (true);
