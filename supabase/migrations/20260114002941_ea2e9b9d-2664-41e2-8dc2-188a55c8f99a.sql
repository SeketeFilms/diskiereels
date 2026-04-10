-- Add subtitles column to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS subtitles JSONB DEFAULT NULL;

-- Add transcription_status to track processing
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT NULL;

COMMENT ON COLUMN public.videos.subtitles IS 'JSON array of subtitle segments with text, start, and end times';
COMMENT ON COLUMN public.videos.transcription_status IS 'Status: pending, processing, completed, failed';