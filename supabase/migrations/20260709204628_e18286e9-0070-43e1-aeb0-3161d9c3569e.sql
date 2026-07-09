
-- Fix signup failure: copy_*_to_merged trigger fns lack search_path so they can't find public.merged_users when auth runs them.
CREATE OR REPLACE FUNCTION public.copy_auth_to_merged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.merged_users (id, email, username, source, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', 'supabase', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_supabase_auth_to_merged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.merged_users (id, email, username, source, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', 'supabase', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_lovable_auth_to_merged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.merged_users (id, email, username, source, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', 'lovable', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Extend admin backend status to surface exact tables/functions behind the two aggregate findings
CREATE OR REPLACE FUNCTION public.get_backend_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
  monitored text[] := ARRAY['users','documents','accessibility','verification_logs'];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT jsonb_build_object(
    'project_ref', current_setting('cluster_name', true),
    'database', current_database(),
    'checked_at', now(),
    'tables', (
      SELECT jsonb_agg(jsonb_build_object(
        'table', t,
        'rls_enabled', COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t), false),
        'policy_count', COALESCE((SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename=t), 0),
        'policies', COALESCE((SELECT jsonb_agg(policyname ORDER BY policyname) FROM pg_policies WHERE schemaname='public' AND tablename=t), '[]'::jsonb)
      ))
      FROM unnest(monitored) AS t
    ),
    'rls_disabled_public_tables', (
      SELECT COALESCE(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false
    ),
    'security_definer_executable_by_authenticated', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'function', p.proname,
        'schema', n.nspname,
        'args', pg_get_function_identity_arguments(p.oid)
      ) ORDER BY p.proname), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_backend_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_backend_status() TO authenticated;
