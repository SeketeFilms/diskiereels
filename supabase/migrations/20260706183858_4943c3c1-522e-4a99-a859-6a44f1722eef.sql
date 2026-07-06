
-- 1) RLS on exposed public tables
ALTER TABLE public.accessibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read accessibility"
  ON public.accessibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage accessibility"
  ON public.accessibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view their documents"
  ON public.documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can insert their documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can update their documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own row"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read verification logs"
  ON public.verification_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert verification logs"
  ON public.verification_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Remove broad leaderboard SELECT policies; expose limited views instead
DROP POLICY IF EXISTS "Authenticated can view all monetization for leaderboard"
  ON public.creator_monetization;
DROP POLICY IF EXISTS "Authenticated can view all balances for leaderboard"
  ON public.star_balances;

CREATE OR REPLACE VIEW public.star_leaderboard AS
SELECT sb.user_id, sb.total_earned, p.username, p.avatar_url
FROM public.star_balances sb
LEFT JOIN public.profiles p ON p.id = sb.user_id
ORDER BY sb.total_earned DESC
LIMIT 100;
GRANT SELECT ON public.star_leaderboard TO authenticated, anon;

CREATE OR REPLACE VIEW public.creator_monetization_leaderboard AS
SELECT cm.user_id, cm.total_stars_earned, p.username, p.avatar_url
FROM public.creator_monetization cm
LEFT JOIN public.profiles p ON p.id = cm.user_id
ORDER BY cm.total_stars_earned DESC
LIMIT 100;
GRANT SELECT ON public.creator_monetization_leaderboard TO authenticated, anon;

-- 3) Hide plaintext parental PIN from client SELECT
REVOKE SELECT (parental_pin) ON public.parental_controls FROM authenticated, anon;

-- 4) Tighten SECURITY DEFINER function EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile()               FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()                     FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_video_likes_count()              FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_comment_like_notification()      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_comment_notification()           FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_follow_notification()            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_like_notification()              FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_new_video_notification()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_star_gift_notification()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_parental_pin_admin(uuid, text)      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_profile_pin_admin(uuid, text)       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ensure_current_user_profile()           FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_video_views(uuid)             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_parental_pin(uuid, text)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_parental_pin(uuid, text)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_profile_pin(uuid, text)             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_profile_pin(uuid, text)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                FROM anon, public;

-- 5) Move pg_net out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  result bigint;
BEGIN
  SELECT extensions.http_post(
    url := 'https://qrvjxszdskouktbvpwzu.supabase.co/functions/v1/summarize-thread',
    body := json_build_object('id', NEW.id, 'user_id', NEW.user_id, 'title', NEW.title, 'body', NEW.body)::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) INTO result;
  INSERT INTO notification_logs (notification_id, response, created_at)
  VALUES (NEW.id, to_jsonb(result), now());
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_logs (notification_id, response, created_at)
  VALUES (NEW.id, jsonb_build_object('error', SQLERRM), now());
  RETURN NEW;
END;
$function$;

-- 6) Storage: replace broad public SELECT policies with owner-scoped listing
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view videos"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view videos" ON storage.objects;

CREATE POLICY "Users can list own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can list own video files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can list all storage objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('avatars','videos') AND public.has_role(auth.uid(), 'admin'::app_role));

-- 7) realtime.messages: enable RLS + require authenticated subscription
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
