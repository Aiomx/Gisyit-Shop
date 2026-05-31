-- Migration: Add slug field to products table
-- Requirements: 1.1, 1.3 (Slug field definition)

-- Add slug column to products table
ALTER TABLE products
ADD COLUMN slug VARCHAR(255);

-- Create unique index for slug lookups
CREATE UNIQUE INDEX idx_products_slug ON products(slug) WHERE slug IS NOT NULL;

-- Create slug_history table for redirect support
-- Requirements: 5.1, 5.4 (Slug history/alias)
CREATE TABLE IF NOT EXISTS slug_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each old_slug can only exist once in history
    CONSTRAINT slug_history_old_slug_unique UNIQUE (old_slug)
);

-- Index for historical slug lookups
CREATE INDEX idx_slug_history_old_slug ON slug_history(old_slug);
CREATE INDEX idx_slug_history_product ON slug_history(product_id);

-- Comment on columns
COMMENT ON COLUMN products.slug IS 'URL-friendly unique identifier for the product';
COMMENT ON TABLE slug_history IS 'Historical slugs for 301 redirect support when slugs change';
COMMENT ON COLUMN slug_history.old_slug IS 'Previous slug value that should redirect to current product slug';
