ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onesignal_external_id text;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.push_notifications;
CREATE TRIGGER trg_dispatch_push_notification
AFTER INSERT ON public.push_notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();