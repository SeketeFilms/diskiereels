
CREATE OR REPLACE FUNCTION public.get_backend_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
        'rls_enabled', COALESCE((
          SELECT c.relrowsecurity FROM pg_class c
          JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname=t
        ), false),
        'policy_count', COALESCE((
          SELECT count(*)::int FROM pg_policies
          WHERE schemaname='public' AND tablename=t
        ), 0),
        'policies', COALESCE((
          SELECT jsonb_agg(policyname ORDER BY policyname) FROM pg_policies
          WHERE schemaname='public' AND tablename=t
        ), '[]'::jsonb)
      ))
      FROM unnest(monitored) AS t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_backend_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_backend_status() TO authenticated;
