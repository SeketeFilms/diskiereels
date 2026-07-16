DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['videos','likes','comments','video_shares','saved_videos','follows']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;