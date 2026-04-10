-- Fix handle_new_user function to handle duplicate usernames
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
  
  -- Insert the profile with unique username
  INSERT INTO public.profiles (id, username, user_type)
  VALUES (
    NEW.id,
    final_username,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'viewer')
  );
  
  RETURN NEW;
END;
$function$;