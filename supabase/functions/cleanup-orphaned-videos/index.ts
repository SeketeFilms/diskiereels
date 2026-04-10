import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Verify user has admin role
    const { data: roleData, error: roleError } = await userClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all video records
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, video_url, thumbnail_url, title');

    if (videosError) {
      console.error('Failed to fetch videos:', videosError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch videos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orphanedVideos: { id: string; title: string; reason: string }[] = [];
    const checkedVideos: string[] = [];

    for (const video of videos || []) {
      // Extract path from video_url
      const videoPath = extractStoragePath(video.video_url, 'videos');
      
      if (!videoPath) {
        orphanedVideos.push({ 
          id: video.id, 
          title: video.title, 
          reason: 'Invalid video URL format' 
        });
        continue;
      }

      // Check if video file exists in storage
      const { data: videoExists, error: videoCheckError } = await supabase
        .storage
        .from('videos')
        .list(getDirectory(videoPath), {
          search: getFileName(videoPath)
        });

      if (videoCheckError) {
        console.error(`Error checking video ${video.id}:`, videoCheckError);
        continue;
      }

      const fileName = getFileName(videoPath);
      const fileFound = videoExists?.some(f => f.name === fileName);

      if (!fileFound) {
        orphanedVideos.push({ 
          id: video.id, 
          title: video.title, 
          reason: 'Video file not found in storage' 
        });
      } else {
        checkedVideos.push(video.id);
      }
    }

    // Delete orphaned records if requested
    const url = new URL(req.url);
    const shouldDelete = url.searchParams.get('delete') === 'true';

    if (shouldDelete && orphanedVideos.length > 0) {
      const orphanedIds = orphanedVideos.map(v => v.id);
      
      // Delete related records first (likes, comments, saves, analytics)
      await supabase.from('likes').delete().in('video_id', orphanedIds);
      await supabase.from('comments').delete().in('video_id', orphanedIds);
      await supabase.from('saved_videos').delete().in('video_id', orphanedIds);
      await supabase.from('video_analytics').delete().in('video_id', orphanedIds);
      await supabase.from('video_downloads').delete().in('video_id', orphanedIds);
      await supabase.from('notifications').delete().in('video_id', orphanedIds);
      
      // Delete orphaned video records
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .in('id', orphanedIds);

      if (deleteError) {
        console.error('Failed to delete orphaned videos:', deleteError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to delete orphaned videos',
            orphanedVideos,
            validVideos: checkedVideos.length
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          message: `Deleted ${orphanedVideos.length} orphaned video records`,
          deletedVideos: orphanedVideos,
          remainingVideos: checkedVideos.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Cleanup scan complete',
        orphanedVideos,
        validVideos: checkedVideos.length,
        hint: 'Add ?delete=true to actually delete orphaned records'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Cleanup failed', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  
  // Handle different URL formats
  const patterns = [
    new RegExp(`/storage/v1/object/public/${bucket}/(.+)`),
    new RegExp(`/storage/v1/object/sign/${bucket}/(.+)\\?`),
    new RegExp(`${bucket}/(.+)$`)
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return decodeURIComponent(match[1].split('?')[0]);
  }

  return null;
}

function getDirectory(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}
