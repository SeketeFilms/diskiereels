
-- Add RLS policy for leaderboard: allow authenticated users to see all star_balances (for leaderboard)
CREATE POLICY "Authenticated can view all balances for leaderboard"
ON public.star_balances
FOR SELECT
TO authenticated
USING (true);

-- Add RLS policy for creator_monetization leaderboard
CREATE POLICY "Authenticated can view all monetization for leaderboard"
ON public.creator_monetization
FOR SELECT
TO authenticated
USING (true);
