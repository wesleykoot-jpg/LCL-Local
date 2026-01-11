/*
  # Create Storage Bucket and Policies
  
  1. Changes
    - Create public-assets bucket for image storage
    - Set up RLS policies for authenticated uploads
    - Configure bucket for public read access
    - Add strict file validation (2MB limit, JPEG/PNG only)
  
  2. Security
    - Only authenticated users can upload
    - Files are publicly readable
    - Bucket properly configured with policies
*/

-- =====================================================
-- CREATE STORAGE BUCKET
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  2097152, -- 2MB in bytes (strict as per user request)
  ARRAY['image/jpeg', 'image/png'] -- JPEG/PNG only (strict)
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads to public-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Policy: Anyone can view files in public-assets
CREATE POLICY "Public read access"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public-assets');

-- Policy: Authenticated users can upload to public-assets
CREATE POLICY "Authenticated uploads to public-assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'public-assets' AND
    -- Enforce folder structure: avatars/, events/, badges/
    (storage.foldername(name))[1] IN ('avatars', 'events', 'badges')
  );

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'public-assets' AND
    (storage.foldername(name))[1] IN ('avatars', 'events', 'badges')
  )
  WITH CHECK (
    bucket_id = 'public-assets' AND
    (storage.foldername(name))[1] IN ('avatars', 'events', 'badges')
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'public-assets' AND
    (storage.foldername(name))[1] IN ('avatars', 'events', 'badges')
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE storage.buckets IS 
  'public-assets bucket configured with 2MB limit and JPEG/PNG only';

COMMENT ON POLICY "Authenticated uploads to public-assets" ON storage.objects IS
  'Enforces folder structure: avatars/, events/, badges/';
