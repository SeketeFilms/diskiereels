-- Create notification type enum
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'reply');

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Function to create notification for likes
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for comments
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for follows
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();

CREATE TRIGGER on_follow_created
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();