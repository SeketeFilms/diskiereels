-- Add settings columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age_range TEXT DEFAULT '7-9',
ADD COLUMN IF NOT EXISTS profile_pin TEXT,
ADD COLUMN IF NOT EXISTS selected_avatar TEXT DEFAULT '🦊';

-- Create content_settings table
CREATE TABLE IF NOT EXISTS public.content_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cartoon_only_mode BOOLEAN DEFAULT true,
  content_categories TEXT[] DEFAULT ARRAY['comedy', 'adventure', 'learning', 'music'],
  comments_visibility TEXT DEFAULT 'emoji_only',
  interaction_limits BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create parental_controls table
CREATE TABLE IF NOT EXISTS public.parental_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  screen_time_limit INTEGER DEFAULT 60,
  school_hours_lock BOOLEAN DEFAULT false,
  school_start_time TIME DEFAULT '08:00',
  school_end_time TIME DEFAULT '15:00',
  bedtime_lock BOOLEAN DEFAULT false,
  bedtime_start TIME DEFAULT '20:00',
  bedtime_end TIME DEFAULT '07:00',
  parental_pin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create playback_settings table
CREATE TABLE IF NOT EXISTS public.playback_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  autoplay BOOLEAN DEFAULT true,
  video_quality TEXT DEFAULT 'auto',
  subtitles_enabled BOOLEAN DEFAULT false,
  subtitles_size TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.content_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_settings
CREATE POLICY "Users can view their own content settings"
  ON public.content_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content settings"
  ON public.content_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content settings"
  ON public.content_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for parental_controls
CREATE POLICY "Users can view their own parental controls"
  ON public.parental_controls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own parental controls"
  ON public.parental_controls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parental controls"
  ON public.parental_controls FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for playback_settings
CREATE POLICY "Users can view their own playback settings"
  ON public.playback_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own playback settings"
  ON public.playback_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playback settings"
  ON public.playback_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_content_settings_updated_at
  BEFORE UPDATE ON public.content_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_parental_controls_updated_at
  BEFORE UPDATE ON public.parental_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_playback_settings_updated_at
  BEFORE UPDATE ON public.playback_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();