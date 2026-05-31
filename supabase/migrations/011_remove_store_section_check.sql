-- Remove store_section CHECK constraint to allow dynamic sections
-- The store_section field is now deprecated in favor of section_id

-- Drop the CHECK constraint that limits store_section values
ALTER TABLE product_categories 
DROP CONSTRAINT IF EXISTS product_categories_store_section_check;

-- Make store_section nullable since we're transitioning to section_id
ALTER TABLE product_categories 
ALTER COLUMN store_section DROP NOT NULL;
