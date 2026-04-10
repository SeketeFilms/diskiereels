import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is designed to be called via a cron job or scheduled trigger
// It performs automatic weekly cleanup of orphaned records
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
    
    const cleanupResults = {
      orphanedVideos: 0,
      orphanedLikes: 0,
      orphanedComments: 0,
      orphanedNotifications: 0,
      orphanedAnalytics: 0,
      timestamp: new Date().toISOString(),
    };

    // 1. Find and clean orphaned video records (videos without files)
    const { data: videos } = await supabase
      .from('videos')
      .select('id, video_url, title');

    const orphanedVideoIds: string[] = [];

    for (const video of videos || []) {
      const videoPath = extractStoragePath(video.video_url, 'videos');
      
      if (!videoPath) {
        orphanedVideoIds.push(video.id);
        continue;
      }

      const { data: videoExists } = await supabase
        .storage
        .from('videos')
        .list(getDirectory(videoPath), {
          search: getFileName(videoPath)
        });

      const fileName = getFileName(videoPath);
      const fileFound = videoExists?.some(f => f.name === fileName);

      if (!fileFound) {
        orphanedVideoIds.push(video.id);
      }
    }

    if (orphanedVideoIds.length > 0) {
      // Delete related records first
      await supabase.from('likes').delete().in('video_id', orphanedVideoIds);
      await supabase.from('comments').delete().in('video_id', orphanedVideoIds);
      await supabase.from('saved_videos').delete().in('video_id', orphanedVideoIds);
      await supabase.from('video_analytics').delete().in('video_id', orphanedVideoIds);
      await supabase.from('video_downloads').delete().in('video_id', orphanedVideoIds);
      await supabase.from('notifications').delete().in('video_id', orphanedVideoIds);
      
      await supabase.from('videos').delete().in('id', orphanedVideoIds);
      cleanupResults.orphanedVideos = orphanedVideoIds.length;
    }

    // 2. Clean orphaned likes (likes for non-existent videos)
    const { data: allVideoIds } = await supabase.from('videos').select('id');
    const validVideoIds = allVideoIds?.map(v => v.id) || [];

    if (validVideoIds.length > 0) {
      const { count: orphanedLikes } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .not('video_id', 'in', `(${validVideoIds.join(',')})`);
      
      if (orphanedLikes && orphanedLikes > 0) {
        await supabase
          .from('likes')
          .delete()
          .not('video_id', 'in', `(${validVideoIds.join(',')})`);
        cleanupResults.orphanedLikes = orphanedLikes;
      }
    }

    // 3. Clean old read notifications (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: oldNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', true)
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (oldNotifications && oldNotifications > 0) {
      await supabase
        .from('notifications')
        .delete()
        .eq('read', true)
        .lt('created_at', thirtyDaysAgo.toISOString());
      cleanupResults.orphanedNotifications = oldNotifications;
    }

    // 4. Clean old video analytics (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { count: oldAnalytics } = await supabase
      .from('video_analytics')
      .select('*', { count: 'exact', head: true })
      .lt('watched_at', ninetyDaysAgo.toISOString());

    if (oldAnalytics && oldAnalytics > 0) {
      await supabase
        .from('video_analytics')
        .delete()
        .lt('watched_at', ninetyDaysAgo.toISOString());
      cleanupResults.orphanedAnalytics = oldAnalytics;
    }

    // Log cleanup to a cleanup_logs table if it exists
    try {
      await supabase.from('cleanup_logs').insert({
        cleanup_type: 'scheduled_weekly',
        results: cleanupResults,
        executed_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist, that's okay
      console.log('Cleanup logs table not found, skipping log');
    }

    return new Response(
      JSON.stringify({
        message: 'Weekly cleanup completed',
        results: cleanupResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Scheduled cleanup error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Cleanup failed', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  
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
