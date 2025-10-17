import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DelegationNotificationRequest {
  action: "created" | "cancelled";
  delegateEmail: string;
  delegateName: string;
  managerEmail?: string;
  managerName: string;
  startDate: string;
  endDate: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, delegateEmail, delegateName, managerEmail, managerName, startDate, endDate }: DelegationNotificationRequest = await req.json();

    console.log(`Sending delegation ${action} notification`);

    if (action === "created") {
      // Notify delegate about new delegation
      const emailResponse = await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [delegateEmail],
        subject: "Manager Access Delegated to You",
        html: `
          <h1>Manager Access Granted</h1>
          <p>Hello ${delegateName},</p>
          <p>${managerName} has granted you temporary manager access to manage schedules.</p>
          
          <h2>Delegation Details:</h2>
          <ul>
            <li><strong>Delegated by:</strong> ${managerName}</li>
            <li><strong>Start Date:</strong> ${startDate}</li>
            <li><strong>End Date:</strong> ${endDate}</li>
          </ul>
          
          <p>During this period, you will have the same permissions as ${managerName} to view and edit schedules for their teams.</p>
          
          <p><strong>Important:</strong> This access will automatically expire after the end date.</p>
          
          <p>Please log into EriSync to start managing schedules.</p>
          
          <p>Best regards,<br>The EriSync Team</p>
        `,
      });

      console.log("Delegation created notification sent successfully:", emailResponse);

      return new Response(JSON.stringify(emailResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } else if (action === "cancelled") {
      // Notify both parties about cancellation
      const emails = [];

      // Notify delegate
      emails.push(resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [delegateEmail],
        subject: "Manager Delegation Cancelled",
        html: `
          <h1>Delegation Cancelled</h1>
          <p>Hello ${delegateName},</p>
          <p>The manager delegation from ${managerName} has been cancelled.</p>
          
          <h2>Delegation Details:</h2>
          <ul>
            <li><strong>Original Start Date:</strong> ${startDate}</li>
            <li><strong>Original End Date:</strong> ${endDate}</li>
          </ul>
          
          <p>Your temporary manager access has been immediately revoked.</p>
          
          <p>Best regards,<br>The EriSync Team</p>
        `,
      }));

      // Notify manager
      if (managerEmail) {
        emails.push(resend.emails.send({
          from: "EriSync <noreply@erisync.xyz>",
          to: [managerEmail],
          subject: "Delegation Cancellation Confirmed",
          html: `
            <h1>Delegation Cancelled</h1>
            <p>Hello ${managerName},</p>
            <p>Your delegation to ${delegateName} has been successfully cancelled.</p>
            
            <h2>Delegation Details:</h2>
            <ul>
              <li><strong>Delegate:</strong> ${delegateName}</li>
              <li><strong>Original Start Date:</strong> ${startDate}</li>
              <li><strong>Original End Date:</strong> ${endDate}</li>
            </ul>
            
            <p>The delegate's access has been immediately revoked and they have been notified.</p>
            
            <p>Best regards,<br>The EriSync Team</p>
          `,
        }));
      }

      const results = await Promise.all(emails);
      console.log("Delegation cancelled notifications sent successfully:", results);

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
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
