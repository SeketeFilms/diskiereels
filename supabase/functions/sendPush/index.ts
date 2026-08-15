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

    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [externalId] },
        target_channel: 'push',
        headings: { en: title },
        contents: { en: body },
        data: { ...data, type, notification_id: id, url: deepLink },
        url: undefined,
        web_url: `${APP_URL}${deepLink}`,
      }),
    })

    const result = await res.json().catch(() => ({}))

    // Best-effort status update on the queued row
    if (id) {
      await supabase
        .from('push_notifications')
        .update({
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? null : JSON.stringify(result).slice(0, 500),
        })
        .eq('id', id)
    }

    return json({ ok: res.ok, result }, res.ok ? 200 : 502)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
