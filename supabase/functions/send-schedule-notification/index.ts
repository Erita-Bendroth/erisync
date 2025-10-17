import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = [
  'https://erisync.lovable.app',
  'https://erisync.xyz'
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
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
    const { userId, userEmail, userName, scheduleDate, changeDetails, changedBy }: ScheduleNotificationRequest = await req.json();

    console.log("Sending schedule notification to:", userEmail);

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "EriSync <noreply@erisync.xyz>",
      to: [userEmail],
      subject: "Schedule Change Notification",
      html: `
        <h1>Schedule Update</h1>
        <p>Hello ${userName},</p>
        <p>Your schedule has been updated by ${changedBy}.</p>
        
        <h2>Change Details:</h2>
        <p><strong>Date:</strong> ${scheduleDate}</p>
        <p><strong>Changes:</strong> ${changeDetails}</p>
        
        <p>Please log into EriSync to view your updated schedule.</p>
        
        <p>Best regards,<br>The EriSync Team</p>
      `,
    });

    console.log("Schedule notification email sent successfully:", emailResponse);

    // Store in-app notification if userId is provided
    if (userId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

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