CREATE TABLE public.push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  title_template text NOT NULL,
  body_template text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_templates TO anon;
GRANT SELECT ON public.push_templates TO authenticated;
GRANT ALL ON public.push_templates TO service_role;

ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read push templates"
  ON public.push_templates FOR SELECT USING (true);

CREATE POLICY "Admins can insert push templates"
  ON public.push_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update push templates"
  ON public.push_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete push templates"
  ON public.push_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER push_templates_updated_at
  BEFORE UPDATE ON public.push_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.push_templates (event_type, title_template, body_template) VALUES
  ('follow',    'New Follower', '{actor} started following you'),
  ('like',      'New Like',     '{actor} liked your reel'),
  ('comment',   'New Comment',  '{actor} commented on your reel'),
  ('reply',     'New Reply',    '{actor} replied to your comment'),
  ('new_video', 'New Reel',     '{actor} posted a new reel'),
  ('star_gift', 'New Stars',    '{actor} sent you stars!')
ON CONFLICT (event_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_push_notifications_user_created
  ON public.push_notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enqueue_push_notification(
  target_user uuid,
  actor uuid,
  push_type text,
  push_title text,
  push_body text,
  push_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  push_id uuid;
  tpl record;
  prefs record;
  actor_name text;
  final_title text := push_title;
  final_body text := push_body;
  recent_count int;
begin
  if target_user is null or target_user = actor then return null; end if;

  -- Respect the recipient's notification preferences (topics + master switch)
  select * into prefs from public.notification_preferences where user_id = target_user;
  if found then
    if prefs.push_enabled is false then return null; end if;
    if push_type = 'like' and prefs.likes_enabled is false then return null; end if;
    if push_type = 'comment' and prefs.comments_enabled is false then return null; end if;
    if push_type = 'follow' and prefs.follows_enabled is false then return null; end if;
    if push_type = 'reply' and prefs.replies_enabled is false then return null; end if;
    if push_type = 'new_video' and prefs.new_videos_enabled is false then return null; end if;
  end if;

  -- Apply the customizable template for this event type
  select * into tpl from public.push_templates where event_type = push_type;
  if found then
    if tpl.enabled is false then return null; end if;
    actor_name := public.diskie_actor_name(actor);
    final_title := replace(tpl.title_template, '{actor}', actor_name);
    final_body := replace(tpl.body_template, '{actor}', actor_name);
  end if;

  -- Deduplicate: same recipient + actor + type + video within 5 minutes
  if exists (
    select 1 from public.push_notifications p
    where p.user_id = target_user
      and p.actor_id is not distinct from actor
      and p.type = push_type
      and coalesce(p.data->>'video_id', '') = coalesce(push_data->>'video_id', '')
      and p.created_at > now() - interval '5 minutes'
  ) then
    return null;
  end if;

  -- Rate limit: at most 12 pushes per recipient per 10 minutes
  select count(*) into recent_count
  from public.push_notifications
  where user_id = target_user and created_at > now() - interval '10 minutes';
  if recent_count >= 12 then
    return null;
  end if;

  insert into public.push_notifications(user_id, actor_id, type, title, body, data, status)
  values (target_user, actor, push_type, final_title, final_body, coalesce(push_data, '{}'::jsonb), 'pending')
  returning id into push_id;
  return push_id;
exception when others then
  raise warning 'push queue skipped; user action allowed: %', sqlerrm;
  return null;
end;
$function$;