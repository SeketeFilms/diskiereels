-- Create blocks table for user blocking functionality
CREATE TABLE public.blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Enable Row Level Security
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Users can see their own blocks
CREATE POLICY "Users can view their own blocks"
  ON public.blocks
  FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can block others
CREATE POLICY "Users can create blocks"
  ON public.blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock
CREATE POLICY "Users can delete their own blocks"
  ON public.blocks
  FOR DELETE
  USING (auth.uid() = blocker_id);