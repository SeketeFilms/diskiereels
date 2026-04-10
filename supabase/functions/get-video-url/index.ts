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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video_url from request
    const { video_url } = await req.json();
    if (!video_url) {
      return new Response(
        JSON.stringify({ error: 'video_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user has access to this video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('creator_id, id')
      .eq('video_url', video_url)
      .single();

    if (videoError || !video) {
      console.error('Video not found:', videoError);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, all authenticated users can view videos (public feed behavior)
    // In the future, you could add additional access controls here for private videos
    
    // Extract the file path from the video_url
    const videoUrlPath = new URL(video_url).pathname;
    const filePath = videoUrlPath.split('/').slice(-2).join('/'); // Get last two parts (folder/file)

    // Generate a signed URL with 2 hours expiration for viewing
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(filePath, 7200); // 2 hours

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to generate signed URL:', signedUrlError);
      // Fallback to public URL if signed URL fails (file may not exist or bucket is public)
      // This handles cases where files were deleted but records remain
      return new Response(
        JSON.stringify({ signed_url: video_url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ signed_url: signedUrlData.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-video-url function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
