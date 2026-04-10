-- Add star_gift to notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'star_gift';

-- Create trigger function for star gift notifications
CREATE OR REPLACE FUNCTION public.create_star_gift_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only for gift type transactions
  IF NEW.type != 'gift' THEN
    RETURN NEW;
  END IF;
  
  -- Don't notify if gifting to yourself
  IF NEW.from_user_id = NEW.to_user_id THEN
    RETURN NEW;
  END IF;
  
  -- Insert notification for the creator
  INSERT INTO notifications (user_id, actor_id, type, video_id)
  VALUES (NEW.to_user_id, NEW.from_user_id, 'star_gift', NEW.video_id);
  
  RETURN NEW;
END;
$function$;

-- Create trigger on star_transactions
CREATE TRIGGER on_star_gift_created
  AFTER INSERT ON public.star_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_star_gift_notification();