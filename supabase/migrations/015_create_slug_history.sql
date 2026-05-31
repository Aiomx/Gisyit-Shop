-- Migration: Create slug_history table for redirect support
-- Requirements: 5.1, 5.4 - Historical slug tracking for redirects

-- Create slug_history table
CREATE TABLE IF NOT EXISTS slug_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure each old_slug is unique (can only redirect to one product)
    CONSTRAINT slug_history_old_slug_unique UNIQUE (old_slug)
);

-- Index for historical slug lookups (primary use case)
CREATE INDEX idx_slug_history_old_slug ON slug_history(old_slug);

-- Index for querying all historical slugs for a product
CREATE INDEX idx_slug_history_product ON slug_history(product_id);

-- Comment on table for documentation
COMMENT ON TABLE slug_history IS 'Stores historical slugs for products to support 301 redirects when slugs are changed';
COMMENT ON COLUMN slug_history.old_slug IS 'The previous slug that should redirect to the current product slug';

-- Enable RLS
ALTER TABLE slug_history ENABLE ROW LEVEL SECURITY;

-- Public read policy (needed for redirect lookups)
CREATE POLICY "Slug history is viewable by everyone" ON slug_history FOR SELECT USING (true);
