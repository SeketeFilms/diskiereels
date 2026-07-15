ALTER TABLE public.video_shares
  DROP CONSTRAINT IF EXISTS video_shares_user_id_fkey;

ALTER TABLE public.video_shares
  ADD CONSTRAINT video_shares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;