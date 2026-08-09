import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

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

    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [userId] },
        target_channel: 'push',
        headings: { en: title },
        contents: { en: body },
        data: { ...data, type, notification_id: id },
      }),
    })

    const result = await res.json().catch(() => ({}))

    // Best-effort status update on the queued row
    if (id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
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
