-- ============================================
-- Admin RLS Policies for Product Management
-- Run this in Supabase SQL Editor to enable admin operations
-- ============================================

-- ============================================
-- STEP 1: Drop existing restrictive policies
-- ============================================
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON product_categories;
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON product_images;
DROP POLICY IF EXISTS "Product specs are viewable by everyone" ON product_specs;
DROP POLICY IF EXISTS "Product spec options are viewable by everyone" ON product_spec_options;
DROP POLICY IF EXISTS "Product prices are viewable by everyone" ON product_prices;
DROP POLICY IF EXISTS "Product videos are viewable by everyone" ON product_videos;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;

-- ============================================
-- STEP 2: Create full access policies
-- (For development - tighten for production with admin role check)
-- ============================================

-- Products: Full access
CREATE POLICY "Products full access" ON products FOR ALL USING (true) WITH CHECK (true);

-- Categories: Full access
CREATE POLICY "Categories full access" ON product_categories FOR ALL USING (true) WITH CHECK (true);

-- Images: Full access
CREATE POLICY "Product images full access" ON product_images FOR ALL USING (true) WITH CHECK (true);

-- Specs: Full access
CREATE POLICY "Product specs full access" ON product_specs FOR ALL USING (true) WITH CHECK (true);

-- Spec Options: Full access
CREATE POLICY "Product spec options full access" ON product_spec_options FOR ALL USING (true) WITH CHECK (true);

-- Prices: Full access
CREATE POLICY "Product prices full access" ON product_prices FOR ALL USING (true) WITH CHECK (true);

-- Videos: Full access
CREATE POLICY "Product videos full access" ON product_videos FOR ALL USING (true) WITH CHECK (true);

-- Orders: Full access for admin management
CREATE POLICY "Orders full access" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Order Items: Full access
CREATE POLICY "Order items full access" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 3: Create Storage Bucket for Images
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'images',
    'images',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow public read
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'images');

-- Storage policy: Allow authenticated uploads
CREATE POLICY "Allow uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');

-- Storage policy: Allow updates
CREATE POLICY "Allow updates" ON storage.objects FOR UPDATE USING (bucket_id = 'images');

-- Storage policy: Allow deletes
CREATE POLICY "Allow deletes" ON storage.objects FOR DELETE USING (bucket_id = 'images');
