-- Add 'new_video' to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_video';

-- Update the new video notification trigger to use 'new_video' type
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
    'new_video',
    NEW.id
  FROM follows f
  WHERE f.following_id = NEW.creator_id;
  
  RETURN NEW;
END;
$$;

-- Create a separate table for profile sensitive data (PINs)
CREATE TABLE IF NOT EXISTS public.profile_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_pin text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;

-- Only user can view their own secrets
CREATE POLICY "Users can view their own secrets" 
ON public.profile_secrets 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only user can insert their own secrets
CREATE POLICY "Users can insert their own secrets" 
ON public.profile_secrets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Only user can update their own secrets
CREATE POLICY "Users can update their own secrets" 
ON public.profile_secrets 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Migrate existing profile_pin data to new table
INSERT INTO public.profile_secrets (user_id, profile_pin)
SELECT id, profile_pin FROM public.profiles WHERE profile_pin IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET profile_pin = EXCLUDED.profile_pin;

-- Create trigger for updated_at
CREATE TRIGGER update_profile_secrets_updated_at
BEFORE UPDATE ON public.profile_secrets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();