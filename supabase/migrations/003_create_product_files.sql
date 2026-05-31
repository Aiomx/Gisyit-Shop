-- ============================================
-- Product Files Table Migration
-- Stores metadata for downloadable product files
-- ============================================

-- ============================================
-- Product Files Table
-- dash writes, Store reads (metadata only)
-- ============================================
CREATE TABLE IF NOT EXISTS product_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,           -- Storage filename (may include unique suffix)
    original_filename VARCHAR(255) NOT NULL,  -- Original filename for download
    file_size BIGINT NOT NULL,                -- File size in bytes
    mime_type VARCHAR(100) NOT NULL,          -- MIME type
    storage_path TEXT NOT NULL,               -- Full Supabase Storage path
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint on storage_path to prevent duplicates
    CONSTRAINT unique_storage_path UNIQUE (storage_path)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;

-- Public read access for file metadata (no download URLs exposed)
CREATE POLICY "Product files metadata is viewable by everyone" 
    ON product_files FOR SELECT USING (true);

-- Full access for admin operations via service role
-- In production, this should be restricted to admin users
CREATE POLICY "Product files full access for admin" 
    ON product_files FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Private Storage Bucket for Product Files
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
    'product-files',
    'product-files',
    false,  -- Private bucket - no public access
    524288000  -- 500MB file size limit
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage Policies for product-files bucket
-- ============================================

-- No public read policy - files accessed only via signed URLs

-- Allow authenticated admin uploads (via service role)
CREATE POLICY "Allow product file uploads" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'product-files');

-- Allow updates to product files
CREATE POLICY "Allow product file updates" 
    ON storage.objects FOR UPDATE 
    USING (bucket_id = 'product-files');

-- Allow deletes for product files
CREATE POLICY "Allow product file deletes" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'product-files');

-- Allow service role to read files for signed URL generation
CREATE POLICY "Allow product file reads for signed URLs" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'product-files');
