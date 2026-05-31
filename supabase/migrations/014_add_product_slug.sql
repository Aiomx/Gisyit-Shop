-- Migration: Add slug field to products table
-- Requirements: 1.1, 1.3 - Slug field definition and uniqueness

-- Add slug column to products table
ALTER TABLE products
ADD COLUMN slug VARCHAR(255);

-- Create unique index for slug lookups
-- Note: Using partial unique index to allow NULL values during migration
CREATE UNIQUE INDEX idx_products_slug_unique ON products(slug) WHERE slug IS NOT NULL;

-- Create regular index for fast slug lookups
CREATE INDEX idx_products_slug ON products(slug);

-- Comment on column for documentation
COMMENT ON COLUMN products.slug IS 'URL-friendly unique identifier for the product. Used for SEO-friendly URLs like /product/{slug}';
