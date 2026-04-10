-- Fix function search paths for security

-- Function to create notification for likes
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Don't notify if user likes their own video
  IF NEW.user_id != (SELECT creator_id FROM videos WHERE id = NEW.video_id) THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id)
    VALUES (
      (SELECT creator_id FROM videos WHERE id = NEW.video_id),
      NEW.user_id,
      'like',
      NEW.video_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Function to create notification for comments
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify video creator (if not commenting on own video)
  IF NEW.user_id != (SELECT creator_id FROM videos WHERE id = NEW.video_id) THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id, comment_id)
    VALUES (
      (SELECT creator_id FROM videos WHERE id = NEW.video_id),
      NEW.user_id,
      'comment',
      NEW.video_id,
      NEW.id
    );
  END IF;
  
  -- Notify parent comment author if it's a reply
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.user_id != (SELECT user_id FROM comments WHERE id = NEW.parent_id) THEN
      INSERT INTO notifications (user_id, actor_id, type, video_id, comment_id)
      VALUES (
        (SELECT user_id FROM comments WHERE id = NEW.parent_id),
        NEW.user_id,
        'reply',
        NEW.video_id,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for follows
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow'
  );
  RETURN NEW;
END;
$$;