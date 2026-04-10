-- Create follows table for creator following system
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Users can view all follows
CREATE POLICY "Users can view all follows"
ON public.follows
FOR SELECT
USING (true);

-- Users can follow creators
CREATE POLICY "Users can create follows"
ON public.follows
FOR INSERT
WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow creators
CREATE POLICY "Users can delete their follows"
ON public.follows
FOR DELETE
USING (auth.uid() = follower_id);

-- Create index for better query performance
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);