-- Add admin role check to set_profile_pin_admin function
CREATE OR REPLACE FUNCTION public.set_profile_pin_admin(_user_id uuid, _raw_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Verify caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Hash PIN server-side using pgcrypto and upsert
  INSERT INTO profile_secrets (user_id, profile_pin)
  VALUES (_user_id, extensions.crypt(_raw_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET profile_pin = extensions.crypt(_raw_pin, extensions.gen_salt('bf', 10)),
                updated_at = now();
END;
$function$;

-- Add admin role check to set_parental_pin_admin function
CREATE OR REPLACE FUNCTION public.set_parental_pin_admin(_user_id uuid, _raw_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Verify caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Upsert parental controls with hashed PIN
  INSERT INTO parental_controls (user_id, parental_pin)
  VALUES (_user_id, extensions.crypt(_raw_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET parental_pin = extensions.crypt(_raw_pin, extensions.gen_salt('bf', 10)),
                updated_at = now();
END;
$function$;