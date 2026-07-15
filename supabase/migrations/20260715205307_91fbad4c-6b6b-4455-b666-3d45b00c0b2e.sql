ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.video_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_target text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.video_shares TO authenticated;
GRANT ALL ON public.video_shares TO service_role;

ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own video shares" ON public.video_shares;
CREATE POLICY "Users can create their own video shares"
ON public.video_shares
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own video shares" ON public.video_shares;
CREATE POLICY "Users can view their own video shares"
ON public.video_shares
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own video shares" ON public.video_shares;
CREATE POLICY "Users can delete their own video shares"
ON public.video_shares
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_video_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET comments_count = comments_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_video_saves_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET saves_count = saves_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos
    SET saves_count = GREATEST(0, saves_count - 1)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_video_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET shares_count = shares_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos
    SET shares_count = GREATEST(0, shares_count - 1)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_video_comments_count_on_insert ON public.comments;
DROP TRIGGER IF EXISTS update_video_comments_count_on_delete ON public.comments;
CREATE TRIGGER update_video_comments_count_on_insert
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_video_comments_count();
CREATE TRIGGER update_video_comments_count_on_delete
AFTER DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_video_comments_count();

DROP TRIGGER IF EXISTS update_video_saves_count_on_insert ON public.saved_videos;
DROP TRIGGER IF EXISTS update_video_saves_count_on_delete ON public.saved_videos;
CREATE TRIGGER update_video_saves_count_on_insert
AFTER INSERT ON public.saved_videos
FOR EACH ROW EXECUTE FUNCTION public.update_video_saves_count();
CREATE TRIGGER update_video_saves_count_on_delete
AFTER DELETE ON public.saved_videos
FOR EACH ROW EXECUTE FUNCTION public.update_video_saves_count();

DROP TRIGGER IF EXISTS update_video_shares_count_on_insert ON public.video_shares;
DROP TRIGGER IF EXISTS update_video_shares_count_on_delete ON public.video_shares;
CREATE TRIGGER update_video_shares_count_on_insert
AFTER INSERT ON public.video_shares
FOR EACH ROW EXECUTE FUNCTION public.update_video_shares_count();
CREATE TRIGGER update_video_shares_count_on_delete
AFTER DELETE ON public.video_shares
FOR EACH ROW EXECUTE FUNCTION public.update_video_shares_count();

UPDATE public.videos v
SET comments_count = COALESCE(c.count, 0)
FROM (
  SELECT video_id, count(*)::integer AS count
  FROM public.comments
  GROUP BY video_id
) c
WHERE v.id = c.video_id;

UPDATE public.videos v
SET comments_count = 0
WHERE NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.video_id = v.id);

UPDATE public.videos v
SET saves_count = COALESCE(s.count, 0)
FROM (
  SELECT video_id, count(*)::integer AS count
  FROM public.saved_videos
  GROUP BY video_id
) s
WHERE v.id = s.video_id;

UPDATE public.videos v
SET saves_count = 0
WHERE NOT EXISTS (SELECT 1 FROM public.saved_videos s WHERE s.video_id = v.id);

UPDATE public.videos v
SET shares_count = COALESCE(s.count, 0)
FROM (
  SELECT video_id, count(*)::integer AS count
  FROM public.video_shares
  GROUP BY video_id
) s
WHERE v.id = s.video_id;

UPDATE public.videos v
SET shares_count = 0
WHERE NOT EXISTS (SELECT 1 FROM public.video_shares s WHERE s.video_id = v.id);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_videos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_shares;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_video_comments_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_video_saves_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_video_shares_count() FROM PUBLIC, anon, authenticated;