-- ===========================================
-- FIX: Notification Triggers - Add Deduplication
-- ===========================================

-- Update create_like_notification to prevent duplicate notifications within 5 minutes
CREATE OR REPLACE FUNCTION public.create_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
  video_creator_id UUID;
BEGIN
  -- Get video creator
  SELECT creator_id INTO video_creator_id FROM videos WHERE id = NEW.video_id;
  
  -- Don't notify if user likes their own video
  IF NEW.user_id = video_creator_id THEN
    RETURN NEW;
  END IF;
  
  -- Check for recent duplicate notifications (within 5 minutes)
  SELECT COUNT(*) INTO recent_count
  FROM notifications
  WHERE user_id = video_creator_id
    AND actor_id = NEW.user_id
    AND type = 'like'
    AND video_id = NEW.video_id
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- Only insert if no recent duplicate
  IF recent_count = 0 THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id)
    VALUES (video_creator_id, NEW.user_id, 'like', NEW.video_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update create_comment_notification to prevent duplicate notifications
CREATE OR REPLACE FUNCTION public.create_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
  video_creator_id UUID;
  parent_author_id UUID;
BEGIN
  -- Get video creator
  SELECT creator_id INTO video_creator_id FROM videos WHERE id = NEW.video_id;
  
  -- Notify video creator (if not commenting on own video)
  IF NEW.user_id != video_creator_id THEN
    -- Check for recent duplicate
    SELECT COUNT(*) INTO recent_count
    FROM notifications
    WHERE user_id = video_creator_id
      AND actor_id = NEW.user_id
      AND type = 'comment'
      AND video_id = NEW.video_id
      AND created_at > NOW() - INTERVAL '1 minute';
    
    IF recent_count = 0 THEN
      INSERT INTO notifications (user_id, actor_id, type, video_id, comment_id)
      VALUES (video_creator_id, NEW.user_id, 'comment', NEW.video_id, NEW.id);
    END IF;
  END IF;
  
  -- Notify parent comment author if it's a reply
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author_id FROM comments WHERE id = NEW.parent_id;
    
    IF NEW.user_id != parent_author_id THEN
      -- Check for recent duplicate reply notifications
      SELECT COUNT(*) INTO recent_count
      FROM notifications
      WHERE user_id = parent_author_id
        AND actor_id = NEW.user_id
        AND type = 'reply'
        AND video_id = NEW.video_id
        AND created_at > NOW() - INTERVAL '1 minute';
      
      IF recent_count = 0 THEN
        INSERT INTO notifications (user_id, actor_id, type, video_id, comment_id)
        VALUES (parent_author_id, NEW.user_id, 'reply', NEW.video_id, NEW.id);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update create_follow_notification to prevent duplicate notifications
CREATE OR REPLACE FUNCTION public.create_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check for recent duplicate follow notifications (within 5 minutes)
  SELECT COUNT(*) INTO recent_count
  FROM notifications
  WHERE user_id = NEW.following_id
    AND actor_id = NEW.follower_id
    AND type = 'follow'
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- Only insert if no recent duplicate
  IF recent_count = 0 THEN
    INSERT INTO notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update create_comment_like_notification to prevent duplicate notifications
CREATE OR REPLACE FUNCTION public.create_comment_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_author_id UUID;
  recent_count INTEGER;
BEGIN
  -- Get the comment author
  SELECT user_id INTO comment_author_id FROM comments WHERE id = NEW.comment_id;
  
  -- Don't notify if user likes their own comment
  IF NEW.user_id = comment_author_id THEN
    RETURN NEW;
  END IF;
  
  -- Check for recent duplicate
  SELECT COUNT(*) INTO recent_count
  FROM notifications
  WHERE user_id = comment_author_id
    AND actor_id = NEW.user_id
    AND type = 'like'
    AND comment_id = NEW.comment_id
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  IF recent_count = 0 THEN
    INSERT INTO notifications (user_id, actor_id, type, comment_id)
    VALUES (comment_author_id, NEW.user_id, 'like', NEW.comment_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update create_new_video_notification to limit bulk notifications
CREATE OR REPLACE FUNCTION public.create_new_video_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_count INTEGER;
BEGIN
  -- Count followers to prevent notification bomb
  SELECT COUNT(*) INTO follower_count
  FROM follows WHERE following_id = NEW.creator_id;
  
  -- Only send if follower count is reasonable (limit to 500)
  IF follower_count <= 500 THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id)
    SELECT 
      f.follower_id,
      NEW.creator_id,
      'new_video',
      NEW.id
    FROM follows f
    WHERE f.following_id = NEW.creator_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add index for notification deduplication performance
CREATE INDEX IF NOT EXISTS idx_notifications_dedup 
ON notifications(user_id, actor_id, type, video_id, created_at DESC);

-- ===========================================
-- FIX: Counter Race Condition - Use Database Triggers
-- ===========================================

-- Create function to automatically update likes_count
CREATE OR REPLACE FUNCTION public.update_video_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos 
    SET likes_count = GREATEST(0, likes_count - 1) 
    WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for likes count
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION public.update_video_likes_count();

-- Create function to atomically increment views
CREATE OR REPLACE FUNCTION public.increment_video_views(_video_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE videos 
  SET views_count = views_count + 1 
  WHERE id = _video_id;
$$;

-- ===========================================
-- FIX: Input Validation - Add Database Constraints
-- ===========================================

-- Add check constraints for video metadata
ALTER TABLE videos 
DROP CONSTRAINT IF EXISTS title_length,
DROP CONSTRAINT IF EXISTS description_length,
DROP CONSTRAINT IF EXISTS tags_count;

ALTER TABLE videos 
ADD CONSTRAINT title_length CHECK (char_length(title) <= 500),
ADD CONSTRAINT description_length CHECK (description IS NULL OR char_length(description) <= 5000),
ADD CONSTRAINT tags_count CHECK (tags IS NULL OR array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 20);

-- ===========================================
-- FIX: Reports Admin Access - Add Admin RLS Policy
-- ===========================================

-- Add admin policy to view all reports for moderation
CREATE POLICY "Admins can view all reports for moderation"
  ON reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'));