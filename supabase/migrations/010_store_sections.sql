-- Store Sections (大板块) Management
-- Allows dynamic creation and management of store sections like "人工智能", "应用软件", etc.

-- ============================================
-- Store Sections Table
-- ============================================
CREATE TABLE IF NOT EXISTS store_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),  -- Icon name for UI display (e.g., 'brain', 'app-window', 'gamepad')
    color VARCHAR(20), -- Theme color (e.g., '#8B5CF6')
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Migrate existing store_section values
-- ============================================
-- Insert existing sections as records (using gen_random_uuid() for IDs)
INSERT INTO store_sections (name, slug, icon, color, sort_order, is_active) VALUES
    ('应用软件', 'apps', 'app-window', '#3B82F6', 1, true),
    ('游戏', 'games', 'gamepad-2', '#10B981', 2, true),
    ('实物商店', 'store', 'shopping-bag', '#F59E0B', 3, true),
    ('海外代购', 'overseas', 'globe', '#EC4899', 4, true),
    ('人工智能', 'ai', 'brain', '#8B5CF6', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Modify product_categories table
-- ============================================
-- Add section_id column to reference store_sections
ALTER TABLE product_categories 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES store_sections(id);

-- Migrate existing store_section values to section_id using subqueries
UPDATE product_categories 
SET section_id = (SELECT id FROM store_sections WHERE slug = 'apps')
WHERE store_section = 'apps' AND section_id IS NULL;

UPDATE product_categories 
SET section_id = (SELECT id FROM store_sections WHERE slug = 'games')
WHERE store_section = 'games' AND section_id IS NULL;

UPDATE product_categories 
SET section_id = (SELECT id FROM store_sections WHERE slug = 'store')
WHERE store_section = 'store' AND section_id IS NULL;

UPDATE product_categories 
SET section_id = (SELECT id FROM store_sections WHERE slug = 'overseas')
WHERE store_section = 'overseas' AND section_id IS NULL;

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_store_sections_slug ON store_sections(slug);
CREATE INDEX IF NOT EXISTS idx_store_sections_active ON store_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_store_sections_sort ON store_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_categories_section ON product_categories(section_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE store_sections ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Store sections are viewable by everyone" 
ON store_sections FOR SELECT USING (is_active = true);

-- Admin full access (for dash)
CREATE POLICY "Store sections full access" 
ON store_sections FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Updated timestamp trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_store_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_sections_updated_at ON store_sections;
CREATE TRIGGER store_sections_updated_at
    BEFORE UPDATE ON store_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_store_sections_updated_at();
