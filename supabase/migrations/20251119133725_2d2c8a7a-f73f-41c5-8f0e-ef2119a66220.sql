-- Create video analytics table for tracking detailed viewing metrics
CREATE TABLE IF NOT EXISTS public.video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  watch_duration INTEGER NOT NULL DEFAULT 0, -- in seconds
  completed BOOLEAN DEFAULT false,
  device_type TEXT,
  CONSTRAINT fk_video FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.video_analytics ENABLE ROW LEVEL SECURITY;

-- Creators can view analytics for their own videos
CREATE POLICY "Creators can view analytics for their videos"
ON public.video_analytics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.videos
    WHERE videos.id = video_analytics.video_id
    AND videos.creator_id = auth.uid()
  )
);

-- Anyone can insert analytics (for tracking)
CREATE POLICY "Anyone can insert video analytics"
ON public.video_analytics
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_video_analytics_video_id ON public.video_analytics(video_id);
CREATE INDEX idx_video_analytics_viewer_id ON public.video_analytics(viewer_id);
CREATE INDEX idx_video_analytics_watched_at ON public.video_analytics(watched_at);