-- First, insert missing creative roles for existing creative users
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'creative'::app_role
FROM public.profiles p
WHERE p.user_type = 'creative'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'creative'
);

-- Update the handle_new_user function to also create user_roles entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  username_suffix int := 1;
  selected_user_type user_type;
BEGIN
  -- Get the base username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1)
  );
  
  final_username := base_username;
  
  -- Keep trying with incremented suffix until we find a unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || username_suffix::text;
    username_suffix := username_suffix + 1;
  END LOOP;
  
  -- Determine user type
  selected_user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'viewer');
  
  -- Insert the profile with unique username
  INSERT INTO public.profiles (id, username, user_type)
  VALUES (
    NEW.id,
    final_username,
    selected_user_type
  );
  
  -- Also insert into user_roles table for role-based access control
  IF selected_user_type = 'creative' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'creative'::app_role);
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer'::app_role);
  END IF;
  
  RETURN NEW;
END;
$function$;