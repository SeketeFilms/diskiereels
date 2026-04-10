-- Backfill viewer roles for existing viewers who don't have one yet
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'viewer'::app_role
FROM public.profiles p
WHERE p.user_type = 'viewer'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'viewer'
);