import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Create client with user's token to verify identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Starting account deletion for user: ${userId}`);

    // Delete user's data from all tables in correct order (respecting foreign keys)
    
    // 1. Delete notifications
    await supabaseAdmin.from('notifications').delete().or(`user_id.eq.${userId},actor_id.eq.${userId}`);
    console.log('Deleted notifications');

    // 2. Delete comment likes
    await supabaseAdmin.from('comment_likes').delete().eq('user_id', userId);
    console.log('Deleted comment likes');

    // 3. Delete comments
    await supabaseAdmin.from('comments').delete().eq('user_id', userId);
    console.log('Deleted comments');

    // 4. Delete likes
    await supabaseAdmin.from('likes').delete().eq('user_id', userId);
    console.log('Deleted likes');

    // 5. Delete follows
    await supabaseAdmin.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    console.log('Deleted follows');

    // 6. Delete saved videos
    await supabaseAdmin.from('saved_videos').delete().eq('user_id', userId);
    console.log('Deleted saved videos');

    // 7. Delete video downloads
    await supabaseAdmin.from('video_downloads').delete().eq('user_id', userId);
    console.log('Deleted video downloads');

    // 8. Delete video analytics for user's videos and by user
    await supabaseAdmin.from('video_analytics').delete().eq('viewer_id', userId);
    console.log('Deleted video analytics');

    // 9. Delete reports by user
    await supabaseAdmin.from('reports').delete().eq('reporter_id', userId);
    console.log('Deleted reports');

    // 10. Get user's videos to delete from storage
    const { data: userVideos } = await supabaseAdmin
      .from('videos')
      .select('id, video_url, thumbnail_url')
      .eq('creator_id', userId);

    // 11. Delete video files from storage
    if (userVideos && userVideos.length > 0) {
      for (const video of userVideos) {
        if (video.video_url) {
          const videoPath = video.video_url.split('/').pop();
          if (videoPath) {
            await supabaseAdmin.storage.from('videos').remove([videoPath]);
          }
        }
        if (video.thumbnail_url) {
          const thumbPath = video.thumbnail_url.split('/').pop();
          if (thumbPath) {
            await supabaseAdmin.storage.from('videos').remove([thumbPath]);
          }
        }
      }
      console.log('Deleted video files from storage');
    }

    // 12. Delete videos
    await supabaseAdmin.from('videos').delete().eq('creator_id', userId);
    console.log('Deleted videos');

    // 13. Delete user roles
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    console.log('Deleted user roles');

    // 14. Delete settings tables
    await supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId);
    await supabaseAdmin.from('content_settings').delete().eq('user_id', userId);
    await supabaseAdmin.from('parental_controls').delete().eq('user_id', userId);
    await supabaseAdmin.from('playback_settings').delete().eq('user_id', userId);
    await supabaseAdmin.from('profile_secrets').delete().eq('user_id', userId);
    console.log('Deleted user settings');

    // 15. Delete avatar from storage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url, cover_photo_url')
      .eq('id', userId)
      .single();

    if (profile?.avatar_url) {
      const avatarPath = profile.avatar_url.split('/').pop();
      if (avatarPath) {
        await supabaseAdmin.storage.from('avatars').remove([avatarPath]);
      }
    }
    if (profile?.cover_photo_url) {
      const coverPath = profile.cover_photo_url.split('/').pop();
      if (coverPath) {
        await supabaseAdmin.storage.from('avatars').remove([coverPath]);
      }
    }
    console.log('Deleted avatar and cover photo');

    // 16. Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    console.log('Deleted profile');

    // 17. Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Account deletion completed for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
