-- Add new_videos_enabled column to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS new_videos_enabled boolean DEFAULT true;