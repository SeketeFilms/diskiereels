ALTER TABLE public.playback_settings
ADD COLUMN IF NOT EXISTS subtitles_position text DEFAULT 'bottom',
ADD COLUMN IF NOT EXISTS subtitles_background text DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS subtitles_karaoke boolean DEFAULT true;