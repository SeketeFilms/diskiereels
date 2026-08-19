import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

const APP_URL = 'https://diskiereels.lovable.app'

function buildDeepLink(type: string | undefined, data: Record<string, any>): string {
  const actor = data?.actor_id || data?.follower_id
  const videoId = data?.video_id
  const commentId = data?.comment_id
  switch (type) {
    case 'follow':
      return actor ? `/profile/${actor}` : '/notifications'
    case 'comment':
    case 'reply':
      if (videoId) {
        const q = new URLSearchParams({ video: videoId, comments: '1' })
        if (commentId) q.set('comment', commentId)
        return `/feed?${q.toString()}`
      }
      return '/notifications'
    default:
      return videoId ? `/feed?video=${videoId}` : '/notifications'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const payload = await req.json().catch(() => ({}))
    const id: string | undefined = payload?.id
    const userId: string | undefined = payload?.user_id
    const title: string = payload?.title || 'DiskieReels'
    const body: string = payload?.body || 'You have a new notification'
    const type: string | undefined = payload?.type
    const data = payload?.data ?? {}

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ error: 'OneSignal not configured' }, 500)
    }
    if (!userId) {
      return json({ error: 'user_id is required' }, 400)
    }

    // Deep link so tapping the push opens the exact reel / profile / comment
    const deepLink = buildDeepLink(type, data)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Prefer the stored OneSignal external id; fall back to the user id.
    const { data: profile } = await supabase
      .from('profiles')
      .select('onesignal_external_id')
      .eq('id', userId)
      .maybeSingle()

    const externalId = (profile as any)?.onesignal_external_id || userId

    // Rich media: reel thumbnail as the big image, actor avatar as the icon.
    const isHttps = (u: unknown): u is string =>
      typeof u === 'string' && u.startsWith('https://')

    let bigPicture: string | null = null
    let largeIcon: string | null = null

    if (data?.video_id) {
      const { data: video } = await supabase
        .from('videos')
        .select('thumbnail_url')
        .eq('id', data.video_id)
        .maybeSingle()
      if (isHttps((video as any)?.thumbnail_url)) bigPicture = (video as any).thumbnail_url
    }

    const actorId = data?.actor_id || data?.follower_id
    if (actorId) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', actorId)
        .maybeSingle()
      if (isHttps((actor as any)?.avatar_url)) largeIcon = (actor as any).avatar_url
    }

    const notification: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [externalId] },
      target_channel: 'push',
      headings: { en: title },
      contents: { en: body },
      data: { ...data, type, notification_id: id, url: deepLink },
      web_url: `${APP_URL}${deepLink}`,
      android_accent_color: 'FF1DB954',
    }

    if (bigPicture) {
      notification.big_picture = bigPicture
      notification.ios_attachments = { id1: bigPicture }
      notification.chrome_web_image = bigPicture
    }
    if (largeIcon) {
      notification.large_icon = largeIcon
      notification.chrome_web_icon = largeIcon
    }

    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notification),
    })

    const result = await res.json().catch(() => ({}))
    // OneSignal returns 200 even when no device matched the alias — treat that as a failure.
    const hasErrors = !!(result as any)?.errors
    const delivered = res.ok && !hasErrors

    // Best-effort status update on the queued row
    if (id) {
      await supabase
        .from('push_notifications')
        .update({
          status: delivered ? 'sent' : 'failed',
          error: delivered ? null : JSON.stringify((result as any)?.errors ?? result).slice(0, 500),
        })
        .eq('id', id)
    }

    return json({ ok: delivered, deep_link: deepLink, result }, res.ok ? 200 : 502)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
