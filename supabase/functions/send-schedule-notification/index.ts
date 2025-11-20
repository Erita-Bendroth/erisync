import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = [
  'https://erisync.lovable.app',
  'https://erisync.xyz'
];

const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Check for Lovable preview domains (*.lovableproject.com)
  if (origin.endsWith('.lovableproject.com')) return true;
  
  return false;
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = isOriginAllowed(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

// HTML escaping function to prevent XSS
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

interface ScheduleNotificationRequest {
  userId?: string;
  userEmail: string;
  userName: string;
  scheduleDate: string;
  changeDetails: string;
  changedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create authenticated Supabase client
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { userId, userEmail, userName, scheduleDate, changeDetails, changedBy }: ScheduleNotificationRequest = await req.json();

    // Verify caller has permission (admin, planner, manager, or notifying themselves)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPrivilegedRole = roles?.some(r => ['admin', 'planner', 'manager'].includes(r.role));
    const isNotifyingSelf = userId === user.id;

    if (!hasPrivilegedRole && !isNotifyingSelf) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log("Sending schedule notification to:", userEmail);

    // Send email notification with sanitized HTML
    const emailResponse = await resend.emails.send({
      from: "EriSync <noreply@erisync.xyz>",
      to: [userEmail],
      subject: "Schedule Change Notification",
      html: `
        <h1>Schedule Update</h1>
        <p>Hello ${escapeHtml(userName)},</p>
        <p>Your schedule has been updated by ${escapeHtml(changedBy)}.</p>
        
        <h2>Change Details:</h2>
        <p><strong>Date:</strong> ${escapeHtml(scheduleDate)}</p>
        <p><strong>Changes:</strong> ${escapeHtml(changeDetails)}</p>
        
        <p>Please log into EriSync to view your updated schedule.</p>
        
        <p>Best regards,<br>The EriSync Team</p>
      `,
    });

    console.log("Schedule notification email sent successfully:", emailResponse);

    // Store in-app notification if userId is provided
    if (userId) {
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Schedule Updated',
          message: `Your schedule for ${scheduleDate} has been ${changeDetails.toLowerCase()} by ${changedBy}`,
          type: 'schedule_change',
          read: false,
        });

        console.log('In-app notification stored successfully');
      } catch (notifError) {
        console.error('Error storing in-app notification:', notifError);
        // Don't fail the whole request if notification storage fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      emailResponse 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-schedule-notification function:", error);
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
