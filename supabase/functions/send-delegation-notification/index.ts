import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DelegationNotificationRequest {
  delegateEmail: string;
  delegateName: string;
  startDate: string;
  endDate: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { delegateEmail, delegateName, startDate, endDate }: DelegationNotificationRequest = await req.json();

    console.log("Sending delegation notification to:", delegateEmail);

    const emailResponse = await resend.emails.send({
      from: "EriSync <noreply@erisync.xyz>",
      to: [delegateEmail],
      subject: "Manager Access Delegated to You",
      html: `
        <h1>Manager Access Granted</h1>
        <p>Hello ${delegateName},</p>
        <p>You have been granted temporary manager access to manage schedules.</p>
        
        <h2>Delegation Details:</h2>
        <ul>
          <li><strong>Start Date:</strong> ${startDate}</li>
          <li><strong>End Date:</strong> ${endDate}</li>
        </ul>
        
        <p>During this period, you will have the same permissions as the delegating manager to view and edit schedules for their teams.</p>
        
        <p><strong>Important:</strong> This access will automatically expire after the end date.</p>
        
        <p>Please log into EriSync to start managing schedules.</p>
        
        <p>Best regards,<br>The EriSync Team</p>
      `,
    });

    console.log("Delegation notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-delegation-notification function:", error);
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
