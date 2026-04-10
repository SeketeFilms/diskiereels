-- Remove duplicate trigger (keep only one)
DROP TRIGGER IF EXISTS trigger_notify_followers_on_new_video ON public.videos;
DROP FUNCTION IF EXISTS notify_followers_on_new_video();

-- Update the remaining trigger function to prevent self-notifications
CREATE OR REPLACE FUNCTION public.create_new_video_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE f.following_id = NEW.creator_id
    -- Don't notify the creator themselves
    AND f.follower_id != NEW.creator_id;
  END IF;
  
  RETURN NEW;
END;
$function$;