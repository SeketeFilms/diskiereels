-- Create admin-level functions for PIN reset (bypasses auth.uid check)
CREATE OR REPLACE FUNCTION public.set_profile_pin_admin(_user_id uuid, _raw_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Hash PIN server-side using pgcrypto and upsert
  INSERT INTO profile_secrets (user_id, profile_pin)
  VALUES (_user_id, crypt(_raw_pin, gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET profile_pin = crypt(_raw_pin, gen_salt('bf', 10)),
                updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_parental_pin_admin(_user_id uuid, _raw_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert parental controls with hashed PIN
  INSERT INTO parental_controls (user_id, parental_pin)
  VALUES (_user_id, crypt(_raw_pin, gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET parental_pin = crypt(_raw_pin, gen_salt('bf', 10)),
                updated_at = now();
END;
$$;