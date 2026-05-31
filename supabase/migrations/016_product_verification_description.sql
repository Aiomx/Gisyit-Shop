-- Migration: Add verification and description fields to products table
-- Requirements: 1.1, 1.2, 4.1, 4.3, 4.5

-- Add is_verified field with default value false
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Add detail_content field for Markdown formatted product descriptions
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS detail_content TEXT;

-- Add index on is_verified field for efficient filtering of verified products
CREATE INDEX IF NOT EXISTS idx_products_is_verified ON products(is_verified);

-- Add comment for documentation
COMMENT ON COLUMN products.is_verified IS 'Indicates whether the product has been verified (safe, virus-free, open source)';
COMMENT ON COLUMN products.detail_content IS 'Markdown formatted detailed product description';
