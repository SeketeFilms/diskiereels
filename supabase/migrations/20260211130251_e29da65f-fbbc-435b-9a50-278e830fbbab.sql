-- Add YouTube URL column to profiles
ALTER TABLE public.profiles ADD COLUMN youtube_url text DEFAULT NULL;

-- Update default social_links_order to include youtube
ALTER TABLE public.profiles ALTER COLUMN social_links_order SET DEFAULT ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text, 'youtube'::text];

-- Update default social_links_visible to include youtube
ALTER TABLE public.profiles ALTER COLUMN social_links_visible SET DEFAULT ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text, 'youtube'::text];