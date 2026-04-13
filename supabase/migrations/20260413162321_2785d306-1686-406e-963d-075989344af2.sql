
CREATE OR REPLACE FUNCTION public.increment_video_views(_video_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _viewer_id uuid;
  _recent_view_count int;
BEGIN
  _viewer_id := auth.uid();
  
  -- If authenticated, check for a view within the last 24 hours
  IF _viewer_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_view_count
    FROM video_analytics
    WHERE video_id = _video_id
      AND viewer_id = _viewer_id
      AND watched_at > NOW() - INTERVAL '24 hours';
    
    -- Already viewed within 24h, skip increment
    IF _recent_view_count > 0 THEN
      RETURN;
    END IF;
  END IF;
  
  UPDATE videos 
  SET views_count = views_count + 1 
  WHERE id = _video_id;
END;
$$;
