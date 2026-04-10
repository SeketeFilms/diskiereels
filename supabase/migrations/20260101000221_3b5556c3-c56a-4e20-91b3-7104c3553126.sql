-- Add CHECK constraint to enforce safe username characters at database level
-- Only allow alphanumeric characters, underscores, and hyphens (3-30 characters)
ALTER TABLE public.profiles
ADD CONSTRAINT username_safe_characters 
CHECK (username ~ '^[a-zA-Z0-9_-]{3,30}$');