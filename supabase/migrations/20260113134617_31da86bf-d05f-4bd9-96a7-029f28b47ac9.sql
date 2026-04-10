-- Create trigger function to notify followers when a creator uploads a new video
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_video()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notifications for all followers of the video creator
  INSERT INTO public.notifications (user_id, actor_id, type, video_id)
  SELECT 
    f.follower_id,
    NEW.creator_id,
    'new_video'::notification_type,
    NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.creator_id
  -- Don't notify the creator themselves
  AND f.follower_id != NEW.creator_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on videos table for new video uploads
DROP TRIGGER IF EXISTS trigger_notify_followers_on_new_video ON public.videos;
CREATE TRIGGER trigger_notify_followers_on_new_video
  AFTER INSERT ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_on_new_video();