-- Add social media links columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS social_links_order TEXT[] DEFAULT ARRAY['tiktok', 'instagram', 'facebook'],
ADD COLUMN IF NOT EXISTS social_links_visible TEXT[] DEFAULT ARRAY['tiktok', 'instagram', 'facebook'];