-- Fix video analytics RLS policy to only allow users to insert their own viewing records
DROP POLICY IF EXISTS "Anyone can insert video analytics" ON video_analytics;

CREATE POLICY "Users can insert their own video analytics" 
ON video_analytics 
FOR INSERT 
WITH CHECK (
  (auth.uid() = viewer_id) OR (viewer_id IS NULL AND auth.uid() IS NOT NULL)
);

-- Add trigger for new video upload notifications to followers
CREATE OR REPLACE FUNCTION public.create_new_video_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify all followers when a creator uploads a new video
  INSERT INTO notifications (user_id, actor_id, type, video_id)
  SELECT 
    f.follower_id,
    NEW.creator_id,
    'like', -- Using 'like' type since we don't have 'new_video' type
    NEW.id
  FROM follows f
  WHERE f.following_id = NEW.creator_id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_new_video_uploaded ON videos;

-- Create trigger for new video notifications
CREATE TRIGGER on_new_video_uploaded
  AFTER INSERT ON videos
  FOR EACH ROW EXECUTE FUNCTION public.create_new_video_notification();

-- Add trigger for comment like notifications
CREATE OR REPLACE FUNCTION public.create_comment_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_author_id uuid;
BEGIN
  -- Get the comment author
  SELECT user_id INTO comment_author_id FROM comments WHERE id = NEW.comment_id;
  
  -- Don't notify if user likes their own comment
  IF NEW.user_id != comment_author_id THEN
    INSERT INTO notifications (user_id, actor_id, type, comment_id)
    VALUES (
      comment_author_id,
      NEW.user_id,
      'like',
      NEW.comment_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_comment_liked ON comment_likes;

-- Create trigger for comment like notifications
CREATE TRIGGER on_comment_liked
  AFTER INSERT ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.create_comment_like_notification();