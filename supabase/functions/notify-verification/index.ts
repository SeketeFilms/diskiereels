import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { verification_id, user_id, full_name, business_email, username } = await req.json();

    if (!verification_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'verification_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin emails from user_roles
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No admins found to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin profiles to get their emails
    const adminIds = adminRoles.map(r => r.user_id);
    
    // Get admin users from auth
    const adminEmails: string[] = [];
    for (const adminId of adminIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(adminId);
      if (userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    // Send email notification using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey && adminEmails.length > 0) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ToonlyReels <notifications@toonlyreels.lovable.app>',
          to: adminEmails,
          subject: `🔔 New Verification Request from @${username || 'Unknown'}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #FF0000, #F97316, #FFD700); padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏆 ToonlyReels</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">New Verification Request</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="color: #1a1a1a; margin: 0 0 16px;">Creator Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; width: 40%;">Username:</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">@${username || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Full Name:</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${full_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Business Email:</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${business_email || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Verification ID:</td>
                    <td style="padding: 8px 0; color: #888; font-size: 12px;">${verification_id}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; padding: 20px;">
                <p style="color: #666; margin: 0;">Please review this request in your admin dashboard.</p>
              </div>
              
              <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; margin-top: 20px;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated notification from ToonlyReels.
                </p>
              </div>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Failed to send email:', await emailResponse.text());
      } else {
        console.log('Verification notification sent to:', adminEmails.join(', '));
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified_admins: adminEmails.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-verification function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
