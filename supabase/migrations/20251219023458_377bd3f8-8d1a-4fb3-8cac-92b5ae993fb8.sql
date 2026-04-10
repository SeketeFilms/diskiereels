-- Enable pgcrypto for server-side hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migrate any remaining PINs from profiles to profile_secrets before dropping column
INSERT INTO profile_secrets (user_id, profile_pin)
SELECT id, profile_pin 
FROM profiles 
WHERE profile_pin IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop the legacy profile_pin column from profiles table
ALTER TABLE profiles DROP COLUMN IF EXISTS profile_pin;

-- Create server-side function to set profile PIN
CREATE OR REPLACE FUNCTION public.set_profile_pin(
  _user_id UUID,
  _raw_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the user
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Hash PIN server-side using pgcrypto and upsert
  INSERT INTO profile_secrets (user_id, profile_pin)
  VALUES (_user_id, crypt(_raw_pin, gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET profile_pin = crypt(_raw_pin, gen_salt('bf', 10)),
                updated_at = now();
END;
$$;

-- Create server-side function to set parental PIN
CREATE OR REPLACE FUNCTION public.set_parental_pin(
  _user_id UUID,
  _raw_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Upsert parental controls with hashed PIN
  INSERT INTO parental_controls (user_id, parental_pin)
  VALUES (_user_id, crypt(_raw_pin, gen_salt('bf', 10)))
  ON CONFLICT (user_id) 
  DO UPDATE SET parental_pin = crypt(_raw_pin, gen_salt('bf', 10)),
                updated_at = now();
END;
$$;

-- Create function to verify profile PIN
CREATE OR REPLACE FUNCTION public.verify_profile_pin(
  _user_id UUID,
  _raw_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT profile_pin INTO stored_hash
  FROM profile_secrets
  WHERE user_id = _user_id;
  
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN crypt(_raw_pin, stored_hash) = stored_hash;
END;
$$;

-- Create function to verify parental PIN
CREATE OR REPLACE FUNCTION public.verify_parental_pin(
  _user_id UUID,
  _raw_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT parental_pin INTO stored_hash
  FROM parental_controls
  WHERE user_id = _user_id;
  
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN crypt(_raw_pin, stored_hash) = stored_hash;
END;
$$;