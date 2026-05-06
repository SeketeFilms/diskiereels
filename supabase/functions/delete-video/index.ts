import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)
  );
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Extract storage object path from a public URL like
// https://<ref>.supabase.co/storage/v1/object/public/videos/<path>
function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/videos/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const videoId = body?.videoId;
    if (!videoId || typeof videoId !== 'string') {
      return new Response(JSON.stringify({ error: 'videoId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load video and verify ownership
    const { data: video, error: vErr } = await supabaseAdmin
      .from('videos')
      .select('id, creator_id, video_url, thumbnail_url')
      .eq('id', videoId)
      .single();

    if (vErr || !video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (video.creator_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove storage objects (video + thumbnail) — best effort
    const paths: string[] = [];
    const vp = extractStoragePath(video.video_url);
    const tp = extractStoragePath(video.thumbnail_url);
    if (vp) paths.push(vp);
    if (tp) paths.push(tp);
    if (paths.length > 0) {
      const { error: rmErr } = await supabaseAdmin.storage.from('videos').remove(paths);
      if (rmErr) console.warn('Storage remove warning:', rmErr.message);
    }

    // Delete the row (subtitles live on the row, so they go with it)
    const { error: delErr } = await supabaseAdmin.from('videos').delete().eq('id', videoId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-video error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || 'Failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
