-- Fix notification spam vulnerability by restricting direct inserts
-- SECURITY DEFINER triggers will still work (they bypass RLS)

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Prevent all direct client-side inserts to notifications table
-- Notifications should only be created by database triggers (which use SECURITY DEFINER)
CREATE POLICY "Prevent direct notification inserts"
  ON public.notifications
  FOR INSERT
  WITH CHECK (false);