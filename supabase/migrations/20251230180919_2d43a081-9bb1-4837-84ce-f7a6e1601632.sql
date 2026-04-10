-- Fix PUBLIC_DATA_EXPOSURE: Require authentication to view profiles
-- This prevents unauthenticated mass data scraping of children's profiles

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create policy requiring authentication to view profiles
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);