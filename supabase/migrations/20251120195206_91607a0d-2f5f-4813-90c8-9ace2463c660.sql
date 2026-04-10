-- Ensure videos bucket is public for thumbnail access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'videos';