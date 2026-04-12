
-- 1. Fix videos INSERT policy: allow ALL authenticated users to upload
DROP POLICY IF EXISTS "Creatives can create their own videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON public.videos;
CREATE POLICY "Authenticated users can upload videos"
  ON public.videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- 2. Fix storage policies for videos bucket
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can update own videos" ON storage.objects;
CREATE POLICY "Authenticated users can update own videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Authenticated users can delete own videos" ON storage.objects;
CREATE POLICY "Authenticated users can delete own videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;
CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

-- 3. Self-healing profile bootstrap function
CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid;
  _email text;
  _username text;
  _final_username text;
  _suffix int := 1;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _uid) THEN
    RETURN json_build_object('ok', true, 'action', 'exists');
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  _username := COALESCE(split_part(_email, '@', 1), 'user');
  _final_username := _username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = _final_username) LOOP
    _final_username := _username || _suffix::text;
    _suffix := _suffix + 1;
  END LOOP;
  INSERT INTO profiles (id, username, user_type) VALUES (_uid, _final_username, 'creative');
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid) THEN
    INSERT INTO user_roles (user_id, role) VALUES (_uid, 'creative'::app_role);
  END IF;
  RETURN json_build_object('ok', true, 'action', 'created', 'username', _final_username);
END;
$$;

-- 4. Enable realtime on messages and conversations (follows already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

-- 5. Re-create missing triggers
CREATE OR REPLACE TRIGGER on_video_like_insert
  AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_video_likes_count();
CREATE OR REPLACE TRIGGER on_video_like_delete
  AFTER DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_video_likes_count();
CREATE OR REPLACE TRIGGER on_new_follow
  AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.create_follow_notification();
CREATE OR REPLACE TRIGGER on_new_like
  AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.create_like_notification();
CREATE OR REPLACE TRIGGER on_new_comment
  AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.create_comment_notification();
CREATE OR REPLACE TRIGGER on_new_comment_like
  AFTER INSERT ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.create_comment_like_notification();
CREATE OR REPLACE TRIGGER on_new_video
  AFTER INSERT ON public.videos FOR EACH ROW EXECUTE FUNCTION public.create_new_video_notification();
CREATE OR REPLACE TRIGGER on_new_star_gift
  AFTER INSERT ON public.star_transactions FOR EACH ROW EXECUTE FUNCTION public.create_star_gift_notification();
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
