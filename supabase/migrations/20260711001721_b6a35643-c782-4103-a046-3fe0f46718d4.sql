
-- 1) Restore Data-API GRANTs on all public base tables (they were wiped)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
  END LOOP;
END $$;

-- Public-read tables (profiles, videos, comments, follows, hashtags, categories, posts, leaderboards)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.videos TO anon;
GRANT SELECT ON public.comments TO anon;
GRANT SELECT ON public.follows TO anon;
GRANT SELECT ON public.hashtags TO anon;
GRANT SELECT ON public.category TO anon;
GRANT SELECT ON public.post_hashtags TO anon;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.star_packs TO anon;

-- Sequences (for tables using bigserial/identity)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 2) Enable RLS on tables currently without it, with sensible policies
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.category FOR SELECT USING (true);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hashtags are public" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Authenticated can create hashtags" ON public.hashtags FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are public" ON public.posts FOR SELECT USING (true);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post hashtags are public" ON public.post_hashtags FOR SELECT USING (true);

ALTER TABLE public.merged_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view merged_users" ON public.merged_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view notification_logs" ON public.notification_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notification_settings" ON public.notification_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notification_settings" ON public.notification_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) Revoke EXECUTE from authenticated on trigger functions & admin-only helpers
REVOKE EXECUTE ON FUNCTION public.copy_auth_to_merged() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.copy_lovable_auth_to_merged() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.copy_supabase_auth_to_merged() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_comment() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_follow() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_reel_like() FROM authenticated, anon, PUBLIC;
