-- ============================================
-- Enhance Product Videos Table
-- Add additional columns for enhanced video management
-- ============================================

-- Add new columns to product_videos table
ALTER TABLE product_videos 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'external' CHECK (source_type IN ('local', 'youtube', 'bilibili', 'external')),
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS title VARCHAR(200),
ADD COLUMN IF NOT EXISTS duration INTEGER; -- Duration in seconds

-- Update video_type constraint to include new types
ALTER TABLE product_videos 
DROP CONSTRAINT IF EXISTS product_videos_video_type_check;

ALTER TABLE product_videos 
ADD CONSTRAINT product_videos_video_type_check 
CHECK (video_type IN ('demo', 'tutorial', 'review', 'trailer'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_videos_product_type ON product_videos(product_id, video_type);
CREATE INDEX IF NOT EXISTS idx_product_videos_source ON product_videos(source_type);

-- Update RLS policy to ensure full access for admin operations
DROP POLICY IF EXISTS "Product videos are viewable by everyone" ON product_videos;
DROP POLICY IF EXISTS "Product videos full access" ON product_videos;

-- Create comprehensive policy for video management
CREATE POLICY "Product videos full access" ON product_videos FOR ALL USING (true) WITH CHECK (true);