import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

// Allowed origins for CORS - restrict to specific domains
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
];

// Get CORS headers based on request origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is in allowed list or matches lovable.app subdomain
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video_id from request
    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'video_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video details with creator info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        video_url, 
        title, 
        creator_id,
        profiles!videos_creator_id_fkey(username)
      `)
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      console.error('Video fetch failed:', videoError);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creatorUsername = (video.profiles as any)?.username || 'ToonReels';

    // Extract the file path from the video_url
    const videoUrlPath = new URL(video.video_url).pathname;
    const filePath = videoUrlPath.split('/').slice(-2).join('/');

    // Generate signed URL for the video (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to generate signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the download
    await supabase.from('video_downloads').insert({
      video_id,
      user_id: user.id
    });

    console.log(`Video download authorized. User: ${user.id}, Video: ${video_id}, Creator: @${creatorUsername}`);

    // Return the signed URL and creator info for client-side watermarking
    return new Response(
      JSON.stringify({ 
        download_url: signedUrlData.signedUrl,
        title: video.title,
        creator_username: creatorUsername,
        apply_watermark: true // Flag to indicate client should apply watermark
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in download-video function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
