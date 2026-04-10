import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResetPinRequest {
  pinType: "profile" | "parental";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's token to get their info
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { pinType }: ResetPinRequest = await req.json();
    
    if (!pinType || !["profile", "parental"].includes(pinType)) {
      return new Response(
        JSON.stringify({ error: "Invalid pin type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a new 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Create admin client for updating PIN
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Hash and store the new PIN
    if (pinType === "profile") {
      // Update profile_secrets table with hashed PIN
      const { error: updateError } = await adminClient.rpc("set_profile_pin_admin", {
        _user_id: user.id,
        _raw_pin: newPin,
      });
      
      // If RPC doesn't exist, use direct update with pgcrypto
      if (updateError) {
        const { error } = await adminClient
          .from("profile_secrets")
          .upsert({
            user_id: user.id,
            profile_pin: newPin, // Will be hashed by trigger if exists
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        
        if (error) {
          console.error("Error updating profile PIN:", error);
        }
      }
    } else {
      // Update parental_controls table with hashed PIN
      const { error: updateError } = await adminClient.rpc("set_parental_pin_admin", {
        _user_id: user.id,
        _raw_pin: newPin,
      });
      
      if (updateError) {
        const { error } = await adminClient
          .from("parental_controls")
          .upsert({
            user_id: user.id,
            parental_pin: newPin,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        
        if (error) {
          console.error("Error updating parental PIN:", error);
        }
      }
    }

    // Send email with new PIN
    const pinTypeLabel = pinType === "profile" ? "Profile" : "Parental";
    
    const emailResponse = await resend.emails.send({
      from: "ToonlyReels <onboarding@resend.dev>",
      to: [user.email!],
      subject: `Your ToonlyReels ${pinTypeLabel} PIN Has Been Reset`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B6B, #FF8E53); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .pin-box { background: white; border: 2px dashed #FF6B6B; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
            .pin { font-size: 36px; font-weight: bold; color: #FF6B6B; letter-spacing: 8px; }
            .warning { background: #FFF3CD; border: 1px solid #FFECB5; border-radius: 8px; padding: 15px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎬 ToonlyReels</h1>
              <p>${pinTypeLabel} PIN Reset</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>Your ${pinTypeLabel} PIN for ToonlyReels has been reset. Here is your new PIN:</p>
              
              <div class="pin-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Your New ${pinTypeLabel} PIN</p>
                <p class="pin">${newPin}</p>
              </div>
              
              <p>Please save this PIN securely. You can change it anytime in the Settings page.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you did not request this PIN reset, please change your account password immediately and contact us at info@semogroup.com.
              </div>
              
              <div class="footer">
                <p>© 2026 ToonlyReels by SEMO Group. All rights reserved.</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("PIN reset email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${pinTypeLabel} PIN has been reset and sent to your email` 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-pin function:", error);
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
