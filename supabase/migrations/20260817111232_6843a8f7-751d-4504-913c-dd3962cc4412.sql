-- 1. Templates for save/share
INSERT INTO public.push_templates (event_type, title_template, body_template, enabled)
VALUES
  ('save', 'New save', '{actor} saved your reel', true),
  ('share', 'New share', '{actor} shared your reel', true)
ON CONFLICT (event_type) DO NOTHING;

-- 2. Preferences coverage for save/share/star gifts
CREATE OR REPLACE FUNCTION public.enqueue_push_notification(target_user uuid, actor uuid, push_type text, push_title text, push_body text, push_data jsonb DEFAULT '{}'::jsonb)
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

  select * into prefs from public.notification_preferences where user_id = target_user;
  if found then
    if prefs.push_enabled is false then return null; end if;
    if push_type = 'like' and prefs.likes_enabled is false then return null; end if;
    if push_type = 'comment' and prefs.comments_enabled is false then return null; end if;
    if push_type = 'follow' and prefs.follows_enabled is false then return null; end if;
    if push_type = 'reply' and prefs.replies_enabled is false then return null; end if;
    if push_type = 'new_video' and prefs.new_videos_enabled is false then return null; end if;
    if push_type = 'save' and prefs.saves_enabled is false then return null; end if;
    if push_type = 'share' and prefs.shares_enabled is false then return null; end if;
    if push_type = 'star_gift' and prefs.star_gifts_enabled is false then return null; end if;
  end if;

  select * into tpl from public.push_templates where event_type = push_type;
  if found then
    if tpl.enabled is false then return null; end if;
    actor_name := public.diskie_actor_name(actor);
    final_title := replace(tpl.title_template, '{actor}', actor_name);
    final_body := replace(tpl.body_template, '{actor}', actor_name);
  end if;

  final_title := coalesce(nullif(final_title, ''), 'DiskieReels');
  final_body := coalesce(nullif(final_body, ''), 'You have a new notification');

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

-- 3. Single push path: every in-app notification queues a mobile push
CREATE OR REPLACE FUNCTION public.diskie_push_from_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform public.enqueue_push_notification(
    new.user_id,
    new.actor_id,
    new.type::text,
    'DiskieReels',
    coalesce(new.message, 'You have a new notification'),
    jsonb_strip_nulls(jsonb_build_object(
      'video_id', new.video_id,
      'comment_id', new.comment_id,
      'actor_id', new.actor_id,
      'notification_id', new.id
    ))
  );
  return new;
exception when others then
  raise warning 'push dispatch skipped: %', sqlerrm;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS send_diskiereels_push_after_notification ON public.notifications;
DROP TRIGGER IF EXISTS diskie_push_from_notification ON public.notifications;
CREATE TRIGGER diskie_push_from_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.diskie_push_from_notification();

-- 4. Share activity notification
CREATE OR REPLACE FUNCTION public.diskie_activity_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  owner_id uuid;
begin
  select creator_id into owner_id from public.videos where id = new.video_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;
  insert into public.notifications(user_id, recipient_id, actor_id, video_id, type, message)
  values (owner_id, owner_id, new.user_id, new.video_id, 'share', 'shared your reel')
  on conflict do nothing;
  return new;
exception when others then
  raise warning 'Share notification skipped without rolling back share: %', sqlerrm;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS diskie_activity_share ON public.video_shares;
CREATE TRIGGER diskie_activity_share
AFTER INSERT ON public.video_shares
FOR EACH ROW EXECUTE FUNCTION public.diskie_activity_share();

-- 5. Full row data on realtime deletes / report events
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.diskie_sync_report_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  target_video uuid := case when tg_op = 'DELETE' then old.reported_id else new.reported_id end;
  target_type text := case when tg_op = 'DELETE' then old.reported_type else new.reported_type end;
begin
  if target_type is distinct from 'video' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  update public.videos v
     set reports_count = (select count(*)::integer from public.reports r
                          where r.reported_type = 'video' and r.reported_id = target_video),
         updated_at = now()
   where v.id = target_video;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS diskie_sync_reports ON public.reports;
CREATE TRIGGER diskie_sync_reports
AFTER INSERT OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.diskie_sync_report_counts();