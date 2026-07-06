
DROP VIEW IF EXISTS public.star_leaderboard;
DROP VIEW IF EXISTS public.creator_monetization_leaderboard;

CREATE OR REPLACE FUNCTION public.get_star_leaderboard()
RETURNS TABLE (user_id uuid, total_earned bigint, username text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sb.user_id, sb.total_earned, p.username, p.avatar_url
  FROM public.star_balances sb
  LEFT JOIN public.profiles p ON p.id = sb.user_id
  ORDER BY sb.total_earned DESC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_star_leaderboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_star_leaderboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_creator_monetization_leaderboard()
RETURNS TABLE (user_id uuid, total_stars_earned bigint, username text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.user_id, cm.total_stars_earned, p.username, p.avatar_url
  FROM public.creator_monetization cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  ORDER BY cm.total_stars_earned DESC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_creator_monetization_leaderboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_monetization_leaderboard() TO authenticated;
