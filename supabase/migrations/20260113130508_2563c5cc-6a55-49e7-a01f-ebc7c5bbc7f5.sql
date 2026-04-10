-- Add screen_time_enabled and profile_pin_enabled columns to parental_controls
ALTER TABLE public.parental_controls 
ADD COLUMN IF NOT EXISTS screen_time_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS profile_pin_enabled boolean DEFAULT true;