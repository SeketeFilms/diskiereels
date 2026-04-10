import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StorageStats {
  totalVideos: number;
  totalVideoSize: number;
  totalAvatars: number;
  totalAvatarSize: number;
  totalThumbnails: number;
  totalThumbnailSize: number;
  totalSize: number;
  lastCleanup: string | null;
  orphanedRecords: number;
}

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

    const stats: StorageStats = {
      totalVideos: 0,
      totalVideoSize: 0,
      totalAvatars: 0,
      totalAvatarSize: 0,
      totalThumbnails: 0,
      totalThumbnailSize: 0,
      totalSize: 0,
      lastCleanup: null,
      orphanedRecords: 0,
    };

    // Get video files from storage
    const { data: videoFiles } = await supabase
      .storage
      .from('videos')
      .list('', { limit: 1000 });

    if (videoFiles) {
      for (const item of videoFiles) {
        if (item.metadata) {
          // It's a file with metadata
          stats.totalVideoSize += item.metadata.size || 0;
          stats.totalVideos++;
        } else {
          // It's a folder, list its contents
          const { data: folderFiles } = await supabase
            .storage
            .from('videos')
            .list(item.name, { limit: 1000 });
          
          if (folderFiles) {
            for (const file of folderFiles) {
              if (file.metadata) {
                const size = file.metadata.size || 0;
                const name = file.name.toLowerCase();
                
                if (name.includes('thumb') || name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.webp')) {
                  stats.totalThumbnails++;
                  stats.totalThumbnailSize += size;
                } else {
                  stats.totalVideos++;
                  stats.totalVideoSize += size;
                }
              }
            }
          }
        }
      }
    }

    // Get avatar files from storage
    const { data: avatarFiles } = await supabase
      .storage
      .from('avatars')
      .list('', { limit: 1000 });

    if (avatarFiles) {
      for (const item of avatarFiles) {
        if (item.metadata) {
          stats.totalAvatarSize += item.metadata.size || 0;
          stats.totalAvatars++;
        } else {
          // It's a folder
          const { data: folderFiles } = await supabase
            .storage
            .from('avatars')
            .list(item.name, { limit: 1000 });
          
          if (folderFiles) {
            for (const file of folderFiles) {
              if (file.metadata) {
                stats.totalAvatars++;
                stats.totalAvatarSize += file.metadata.size || 0;
              }
            }
          }
        }
      }
    }

    // Calculate total size
    stats.totalSize = stats.totalVideoSize + stats.totalAvatarSize + stats.totalThumbnailSize;

    // Check for orphaned video records
    const { data: videos } = await supabase
      .from('videos')
      .select('id, video_url');

    let orphanedCount = 0;
    for (const video of videos || []) {
      const videoPath = extractStoragePath(video.video_url, 'videos');
      
      if (!videoPath) {
        orphanedCount++;
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
        orphanedCount++;
      }
    }
    stats.orphanedRecords = orphanedCount;

    // Get last cleanup timestamp
    try {
      const { data: lastLog } = await supabase
        .from('cleanup_logs')
        .select('executed_at')
        .order('executed_at', { ascending: false })
        .limit(1)
        .single();
      
      stats.lastCleanup = lastLog?.executed_at || null;
    } catch {
      stats.lastCleanup = null;
    }

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Storage analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to get storage analytics', details: message }),
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
