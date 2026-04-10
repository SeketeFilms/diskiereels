-- Create saved_videos table for viewers to save videos to watch later
CREATE TABLE IF NOT EXISTS public.saved_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Enable RLS
ALTER TABLE public.saved_videos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own saved videos"
  ON public.saved_videos
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save videos"
  ON public.saved_videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their videos"
  ON public.saved_videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_saved_videos_user_id ON public.saved_videos(user_id);
CREATE INDEX idx_saved_videos_video_id ON public.saved_videos(video_id);