-- Drop the overly permissive "Anyone can view videos" policy
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;

-- Make videos bucket private to prevent unauthorized access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'videos';

-- Add restrictive policy: only authenticated users can view videos
CREATE POLICY "Authenticated users can view videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'videos' 
  AND auth.role() = 'authenticated'
);