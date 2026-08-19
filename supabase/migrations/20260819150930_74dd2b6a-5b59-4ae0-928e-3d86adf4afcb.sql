
UPDATE public.push_templates
SET title_template = '{{actor}} uploaded a new reel — you follow them',
    body_template = '{{reel_title}}',
    updated_at = now()
WHERE event_type = 'new_video';

UPDATE public.notification_templates
SET title_template = '{{actor}} uploaded a new reel — you follow them',
    body_template = '{{reel_title}}',
    updated_at = now()
WHERE event_type = 'new_video';

CREATE OR REPLACE FUNCTION public.diskie_activity_new_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.notifications(user_id, recipient_id, actor_id, video_id, type, message)
  select f.follower_id, f.follower_id, new.creator_id, new.id,
         'new_video'::public.notification_type, 'uploaded a new reel — you follow them'
    from public.follows f
   where f.following_id = new.creator_id
     and f.follower_id <> new.creator_id
  on conflict do nothing;
  return new;
exception when others then
  raise warning 'New reel notifications skipped without rolling back upload: %', sqlerrm;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.push_on_new_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  follower record;
  tpl record;
  push_title text;
  push_body text;
begin
  select title_template, body_template, enabled into tpl
    from public.push_templates where event_type = 'new_video';

  if tpl is null or tpl.enabled is false then
    return new;
  end if;

  push_title := replace(replace(tpl.title_template, '{{actor}}', public.diskie_actor_name(new.creator_id)), '{{reel_title}}', coalesce(new.title, 'a new reel'));
  push_body  := replace(replace(tpl.body_template,  '{{actor}}', public.diskie_actor_name(new.creator_id)), '{{reel_title}}', coalesce(new.title, 'a new reel'));

  for follower in
    select follower_id from public.follows where following_id = new.creator_id and follower_id <> new.creator_id
  loop
    perform public.enqueue_push_notification(
      follower.follower_id,
      new.creator_id,
      'new_video',
      push_title,
      push_body,
      jsonb_build_object('video_id', new.id, 'actor_id', new.creator_id)
    );
  end loop;
  return new;
exception when others then
  raise warning 'DiskieReels new-video push skipped; upload allowed: %', sqlerrm;
  return new;
end;
$$;
