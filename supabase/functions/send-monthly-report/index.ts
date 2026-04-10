import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MonthlyReportRequest {
  recipientEmail: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { recipientEmail, userId }: MonthlyReportRequest = await req.json();
    
    if (!recipientEmail || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, avatar_url, selected_avatar')
      .eq('id', userId)
      .single();

    // Get this month's video analytics
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { data: analytics } = await supabaseClient
      .from('video_analytics')
      .select(`
        watch_duration,
        watched_at,
        completed,
        videos:video_id (tags)
      `)
      .eq('viewer_id', userId)
      .gte('watched_at', startOfMonth.toISOString());

    // Calculate stats
    const totalWatchTime = analytics?.reduce((sum, a) => sum + (a.watch_duration || 0), 0) || 0;
    const totalVideos = analytics?.length || 0;
    const completedVideos = analytics?.filter(a => a.completed)?.length || 0;
    
    // Calculate daily breakdown
    const dailyUsage: Record<string, number> = {};
    analytics?.forEach((item: any) => {
      const date = new Date(item.watched_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      dailyUsage[date] = (dailyUsage[date] || 0) + (item.watch_duration || 0);
    });

    // Calculate category breakdown
    const categories: Record<string, number> = {};
    analytics?.forEach((item: any) => {
      const tags = item.videos?.tags || ['Other'];
      const primaryTag = tags[0] || 'Other';
      categories[primaryTag] = (categories[primaryTag] || 0) + 1;
    });

    // Sort categories by count
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Get likes and comments count for the month
    const { count: likesCount } = await supabaseClient
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    const { count: commentsCount } = await supabaseClient
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    // Format time
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    // Build daily usage HTML
    const dailyUsageHTML = Object.entries(dailyUsage)
      .slice(-7)
      .map(([date, seconds]) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatTime(seconds)}</td>
        </tr>
      `).join('');

    // Build categories HTML
    const categoriesHTML = topCategories.map(([cat, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
        <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
        <span style="font-weight: bold;">${count} videos</span>
      </div>
    `).join('');

    const currentMonth = new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });

    const username = profile?.username || 'User';
    const avatar = profile?.selected_avatar || '🦊';

    const emailResponse = await resend.emails.send({
      from: "ToonlyReels <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `${username}'s ToonlyReels Monthly Report - ${currentMonth}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #FF6B6B, #FF8E53); color: white; padding: 30px; text-align: center; }
            .content { background: #ffffff; padding: 30px; }
            .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
            .stat-box { background: #f8f9fa; border-radius: 12px; padding: 20px; text-align: center; }
            .stat-value { font-size: 28px; font-weight: bold; color: #FF6B6B; }
            .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
            .section { margin: 30px 0; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
            .avatar { font-size: 48px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .highlight { background: linear-gradient(135deg, #FFE5E5, #FFF0E5); border-radius: 12px; padding: 20px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="avatar">${avatar}</div>
              <h1 style="margin: 0;">${username}'s Monthly Report</h1>
              <p style="margin: 5px 0 0;">${currentMonth}</p>
            </div>
            
            <div class="content">
              <div class="highlight">
                <h2 style="margin: 0 0 10px; color: #FF6B6B;">📊 Monthly Summary</h2>
                <p style="margin: 0; color: #666;">Here's how ${username} used ToonlyReels this month</p>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
                <div class="stat-box" style="flex: 1; min-width: 120px;">
                  <div class="stat-value">${formatTime(totalWatchTime)}</div>
                  <div class="stat-label">Total Watch Time</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 120px;">
                  <div class="stat-value">${totalVideos}</div>
                  <div class="stat-label">Videos Watched</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 120px;">
                  <div class="stat-value">${completedVideos}</div>
                  <div class="stat-label">Completed</div>
                </div>
                <div class="stat-box" style="flex: 1; min-width: 120px;">
                  <div class="stat-value">${likesCount || 0}</div>
                  <div class="stat-label">Likes Given</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">📅 Daily Usage (Last 7 Days)</div>
                <table>
                  <thead>
                    <tr style="background: #f8f9fa;">
                      <th style="padding: 10px; text-align: left;">Date</th>
                      <th style="padding: 10px; text-align: right;">Watch Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${dailyUsageHTML || '<tr><td colspan="2" style="padding: 15px; text-align: center; color: #666;">No data yet</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div class="section">
                <div class="section-title">🎬 Favorite Categories</div>
                ${categoriesHTML || '<p style="color: #666;">No category data available</p>'}
              </div>

              <div class="section">
                <div class="section-title">💬 Engagement</div>
                <div style="display: flex; gap: 20px;">
                  <div style="flex: 1; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 24px;">❤️</div>
                    <div style="font-size: 20px; font-weight: bold;">${likesCount || 0}</div>
                    <div style="font-size: 12px; color: #666;">Likes Given</div>
                  </div>
                  <div style="flex: 1; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 24px;">💬</div>
                    <div style="font-size: 20px; font-weight: bold;">${commentsCount || 0}</div>
                    <div style="font-size: 12px; color: #666;">Comments</div>
                  </div>
                </div>
              </div>

              <div class="highlight" style="background: linear-gradient(135deg, #E5F6E5, #E5F0FF);">
                <h3 style="margin: 0 0 10px;">💡 Parenting Tip</h3>
                <p style="margin: 0; font-size: 14px; color: #555;">
                  ${totalWatchTime > 7200 
                    ? "Consider setting stricter screen time limits in the Parent Dashboard to encourage more offline activities."
                    : "Great job managing screen time! Keep encouraging a healthy balance between online and offline activities."}
                </p>
              </div>
            </div>
            
            <div class="footer">
              <p>This report was sent from ToonlyReels Parent Dashboard</p>
              <p>© 2026 ToonlyReels by SEMO Group. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Monthly report sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Monthly report sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-monthly-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
