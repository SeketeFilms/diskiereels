import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log("Starting scheduled monthly report job...");

    // Get all users who have monthly reports enabled
    const { data: reportSettings, error: settingsError } = await supabase
      .from("monthly_report_settings")
      .select("user_id, email")
      .eq("enabled", true);

    if (settingsError) {
      console.log("No monthly_report_settings table or no enabled reports, checking all viewer profiles...");
      
      // Fallback: Get all viewer profiles and their parental controls
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, selected_avatar")
        .eq("user_type", "viewer");

      if (profilesError || !profiles?.length) {
        console.log("No viewer profiles found");
        return new Response(JSON.stringify({ message: "No users to send reports to" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log(`Found ${profiles.length} viewer profiles`);
      let sentCount = 0;

      for (const profile of profiles) {
        try {
          // Get user's auth email
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          if (!authUser?.user?.email) continue;

          const email = authUser.user.email;
          await sendMonthlyReport(supabase, resend, profile.id, email, profile);
          sentCount++;
        } catch (err) {
          console.error(`Failed to send report for user ${profile.id}:`, err);
        }
      }

      return new Response(JSON.stringify({ message: `Sent ${sentCount} monthly reports` }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!reportSettings?.length) {
      console.log("No users with enabled monthly reports");
      return new Response(JSON.stringify({ message: "No users with enabled reports" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending reports to ${reportSettings.length} users...`);
    let sentCount = 0;

    for (const setting of reportSettings) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url, selected_avatar")
          .eq("id", setting.user_id)
          .single();

        await sendMonthlyReport(supabase, resend, setting.user_id, setting.email, profile);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send report for user ${setting.user_id}:`, err);
      }
    }

    return new Response(JSON.stringify({ message: `Sent ${sentCount} monthly reports` }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Scheduled monthly report error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function sendMonthlyReport(
  supabase: any,
  resend: any,
  userId: string,
  email: string,
  profile: any
) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Fetch video analytics for the month
  const { data: analytics } = await supabase
    .from("video_analytics")
    .select(`
      watch_duration,
      completed,
      watched_at,
      video_id,
      videos!fk_video (
        tags,
        title
      )
    `)
    .eq("viewer_id", userId)
    .gte("watched_at", startOfMonth.toISOString())
    .lte("watched_at", endOfMonth.toISOString());

  const totalWatchTime = analytics?.reduce((sum: number, a: any) => sum + (a.watch_duration || 0), 0) || 0;
  const totalVideos = analytics?.length || 0;
  const completedVideos = analytics?.filter((a: any) => a.completed)?.length || 0;

  // Daily breakdown
  const dailyUsage: Record<string, number> = {};
  analytics?.forEach((a: any) => {
    const date = new Date(a.watched_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    dailyUsage[date] = (dailyUsage[date] || 0) + (a.watch_duration || 0);
  });

  // Content categories
  const categories: Record<string, number> = {};
  analytics?.forEach((a: any) => {
    const tags = a.videos?.tags || [];
    if (tags.length > 0) {
      const category = tags[0];
      categories[category] = (categories[category] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Fetch likes and comments
  const { count: likesCount } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString());

  const { count: commentsCount } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString());

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const monthName = startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const username = profile?.username || 'User';
  const avatar = profile?.selected_avatar || '🦊';

  const dailyRows = Object.entries(dailyUsage)
    .slice(0, 7)
    .map(([date, seconds]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatDuration(seconds as number)}</td>
      </tr>
    `).join('');

  const categoryRows = topCategories.map(([cat, count]) => `
    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
      <span style="text-transform: capitalize;">${cat}</span>
      <span style="color: #666;">${count} videos</span>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); padding: 30px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">${avatar}</div>
          <h1 style="color: white; margin: 0; font-size: 24px;">${username}'s Monthly Report</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">${monthName}</p>
        </div>
        
        <div style="padding: 30px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #FF6B6B;">${formatDuration(totalWatchTime)}</div>
              <div style="color: #666; font-size: 14px;">Total Watch Time</div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #FF8E53;">${totalVideos}</div>
              <div style="color: #666; font-size: 14px;">Videos Watched</div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #4ECDC4;">${completedVideos}</div>
              <div style="color: #666; font-size: 14px;">Completed</div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #9B59B6;">${likesCount || 0}</div>
              <div style="color: #666; font-size: 14px;">Likes Given</div>
            </div>
          </div>

          ${dailyRows ? `
          <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px; color: #333;">📊 Daily Activity</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; font-weight: 600;">Date</th>
                  <th style="padding: 10px; text-align: right; font-weight: 600;">Time</th>
                </tr>
              </thead>
              <tbody>${dailyRows}</tbody>
            </table>
          </div>
          ` : ''}

          ${categoryRows ? `
          <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px; color: #333;">🎬 Favorite Categories</h3>
            ${categoryRows}
          </div>
          ` : ''}

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
            <h3 style="margin: 0 0 10px;">💡 Parenting Tip</h3>
            <p style="margin: 0; opacity: 0.95; line-height: 1.5;">
              ${getRandomParentingTip()}
            </p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee;">
          <p style="margin: 0;">This automated report was sent by ToonReels</p>
          <p style="margin: 5px 0 0;">To manage your report preferences, visit the Parent Dashboard</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "ToonReels <noreply@semogroup.com>",
    to: [email],
    subject: `📊 ${username}'s Monthly Activity Report - ${monthName}`,
    html,
  });

  console.log(`Sent monthly report to ${email} for user ${userId}`);
}

function getRandomParentingTip(): string {
  const tips = [
    "Consider watching a video together! It's a great way to understand what content interests your child and opens opportunities for meaningful conversations.",
    "Setting consistent screen time limits helps children develop healthy media habits. The Parent Dashboard makes this easy to manage.",
    "Encourage your child to explore educational content by discussing what they've learned from their favorite videos.",
    "Balance is key! Make sure screen time is complemented with outdoor activities, reading, and family time.",
    "Use the content category data to discover new topics your child might enjoy learning about together.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

serve(handler);
