-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('viewer', 'creative', 'admin');

-- Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Migrate existing user_type data to user_roles
INSERT INTO public.user_roles (user_id, role, assigned_by)
SELECT id, user_type::text::app_role, id
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Update videos INSERT policy to use has_role instead of profiles.user_type
DROP POLICY IF EXISTS "Creatives can create their own videos" ON public.videos;
CREATE POLICY "Creatives can create their own videos"
ON public.videos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = creator_id AND public.has_role(auth.uid(), 'creative')
);

-- Prevent users from updating their own user_type in profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  -- Prevent modification of sensitive fields
  user_type = (SELECT user_type FROM public.profiles WHERE id = auth.uid()) AND
  is_premium = (SELECT is_premium FROM public.profiles WHERE id = auth.uid())
);