-- Drop the current permissive policy that allows anonymous access
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles 
  FOR SELECT
  TO authenticated
  USING (true);