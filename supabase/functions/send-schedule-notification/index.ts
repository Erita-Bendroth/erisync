import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduleNotificationRequest {
  userEmail: string;
  userName: string;
  scheduleDate: string;
  changeDetails: string;
  changedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, scheduleDate, changeDetails, changedBy }: ScheduleNotificationRequest = await req.json();

    console.log("Sending schedule notification to:", userEmail);

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

    return new Response(JSON.stringify(emailResponse), {
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