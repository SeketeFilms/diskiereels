import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all creative users
    const { data: creativeRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'creative');

    if (!creativeRoles || creativeRoles.length === 0) {
      return new Response(JSON.stringify({ message: 'No creators found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString();

    let sentCount = 0;

    for (const role of creativeRoles) {
      try {
        // Get user email
        const { data: { user } } = await supabase.auth.admin.getUserById(role.user_id);
        if (!user?.email) continue;

        // Get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', role.user_id)
          .single();

        if (!profile) continue;

        // Get videos
        const { data: videos } = await supabase
          .from('videos')
          .select('id, title, views_count, likes_count')
          .eq('creator_id', role.user_id);

        const videoIds = videos?.map(v => v.id) || [];

        // Weekly analytics
        let weeklyViews = 0;
        let weeklyWatchTime = 0;
        if (videoIds.length > 0) {
          const { data: analytics } = await supabase
            .from('video_analytics')
            .select('watch_duration')
            .in('video_id', videoIds)
            .gte('watched_at', weekStart);

          weeklyViews = analytics?.length || 0;
          weeklyWatchTime = analytics?.reduce((sum, a) => sum + (a.watch_duration || 0), 0) || 0;
        }

        // Weekly new followers
        const { count: newFollowers } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', role.user_id)
          .gte('created_at', weekStart);

        // Weekly likes
        let weeklyLikes = 0;
        if (videoIds.length > 0) {
          const { count } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .in('video_id', videoIds)
            .gte('created_at', weekStart);
          weeklyLikes = count || 0;
        }

        // Weekly comments
        let weeklyComments = 0;
        if (videoIds.length > 0) {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .in('video_id', videoIds)
            .gte('created_at', weekStart);
          weeklyComments = count || 0;
        }

        // Star earnings
        const { data: starTxns } = await supabase
          .from('star_transactions')
          .select('amount')
          .eq('to_user_id', role.user_id)
          .eq('type', 'gift')
          .gte('created_at', weekStart);

        const weeklyStars = starTxns?.reduce((sum, t) => sum + t.amount, 0) || 0;

        // Top video this week
        const topVideo = videos?.sort((a, b) => b.views_count - a.views_count)[0];

        const totalViews = videos?.reduce((sum, v) => sum + v.views_count, 0) || 0;
        const totalLikes = videos?.reduce((sum, v) => sum + v.likes_count, 0) || 0;
        const watchHours = Math.floor(weeklyWatchTime / 3600);
        const watchMins = Math.floor((weeklyWatchTime % 3600) / 60);

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:24px;font-weight:800;color:#1a1a1a;margin:0;">📊 Weekly Creator Digest</h1>
      <p style="color:#666;font-size:14px;margin:8px 0 0;">Hey @${profile.username}, here's your week in review!</p>
    </div>

    <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 16px;">This Week's Highlights</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">👀 Views</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a1a1a;font-size:15px;">${weeklyViews.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">❤️ Likes</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a1a1a;font-size:15px;">${weeklyLikes.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">💬 Comments</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a1a1a;font-size:15px;">${weeklyComments.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">👥 New Followers</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a1a1a;font-size:15px;">+${(newFollowers || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">⏱️ Watch Time</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#1a1a1a;font-size:15px;">${watchHours}h ${watchMins}m</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;">⭐ Stars Earned</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#f59e0b;font-size:15px;">${weeklyStars.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    ${topVideo ? `
    <div style="background:#fff3cd;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="font-size:13px;color:#856404;margin:0 0 4px;">🏆 Top Performing Toon</p>
      <p style="font-size:15px;font-weight:700;color:#1a1a1a;margin:0;">${topVideo.title}</p>
      <p style="font-size:12px;color:#666;margin:4px 0 0;">${topVideo.views_count.toLocaleString()} views · ${topVideo.likes_count.toLocaleString()} likes</p>
    </div>
    ` : ''}

    <div style="background:#e8f5e9;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="font-size:13px;color:#2e7d32;margin:0 0 4px;">📈 All-Time Stats</p>
      <p style="font-size:14px;color:#1a1a1a;margin:0;">${totalViews.toLocaleString()} total views · ${totalLikes.toLocaleString()} total likes · ${videos?.length || 0} Toonz</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:12px;color:#999;margin:0;">Keep creating amazing content! 🎬</p>
      <p style="font-size:11px;color:#ccc;margin:8px 0 0;">ToonlyReels Weekly Digest</p>
    </div>
  </div>
</body>
</html>`;

        await resend.emails.send({
          from: 'ToonlyReels <noreply@semogroup.com>',
          to: [user.email],
          subject: `📊 Your Weekly Digest — ${weeklyViews} views, ${weeklyLikes} likes, +${newFollowers || 0} followers`,
          html,
        });

        sentCount++;
      } catch (err) {
        console.error(`Failed to send digest to ${role.user_id}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Weekly digest error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
