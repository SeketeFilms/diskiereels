-- Add time columns to parental_controls if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parental_controls' AND column_name = 'school_start_time') THEN
    ALTER TABLE public.parental_controls ADD COLUMN school_start_time TEXT DEFAULT '08:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parental_controls' AND column_name = 'school_end_time') THEN
    ALTER TABLE public.parental_controls ADD COLUMN school_end_time TEXT DEFAULT '15:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parental_controls' AND column_name = 'bedtime_start') THEN
    ALTER TABLE public.parental_controls ADD COLUMN bedtime_start TEXT DEFAULT '21:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parental_controls' AND column_name = 'bedtime_end') THEN
    ALTER TABLE public.parental_controls ADD COLUMN bedtime_end TEXT DEFAULT '07:00';
  END IF;
END $$;