-- Create table to track one-time user type changes
CREATE TABLE IF NOT EXISTS public.user_type_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  original_type text NOT NULL,
  new_type text NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_type_changes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own change record
CREATE POLICY "Users can view own type change" 
ON public.user_type_changes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only insert their own record (once)
CREATE POLICY "Users can insert own type change once" 
ON public.user_type_changes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_type_changes_user_id ON public.user_type_changes(user_id);