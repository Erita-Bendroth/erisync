import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VacationRequestNotification {
  requestId: string;
  type: "request" | "approval" | "rejection";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { requestId, type }: VacationRequestNotification = await req.json();

    console.log(`Processing vacation ${type} notification for request: ${requestId}`);

    // Fetch the vacation request details
    const { data: request, error: requestError } = await supabase
      .from("vacation_requests")
      .select(`
        *,
        requester:profiles!vacation_requests_user_id_fkey(first_name, last_name, email),
        approver:profiles!vacation_requests_approver_id_fkey(first_name, last_name, email),
        team:teams(name)
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message}`);
    }

    if (type === "request") {
      // Get the top-level approver for the team
      const { data: approver, error: approverError } = await supabase
        .rpc("get_top_level_approver_for_team", { _team_id: request.team_id })
        .single();

      if (approverError || !approver) {
        throw new Error(`Failed to find approver: ${approverError?.message}`);
      }

      const dateStr = new Date(request.requested_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const timeStr = request.is_full_day
        ? "Full Day"
        : `${request.start_time} - ${request.end_time}`;

      const approveUrl = `${Deno.env.get("SUPABASE_URL")?.replace("https://", "https://app.")}/schedule?pendingApproval=${requestId}`;

      await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [approver.email],
        subject: `Vacation Request Pending: ${request.requester.first_name} ${request.requester.last_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Vacation Request Pending Approval</h2>
            <p>Hello ${approver.first_name},</p>
            <p>A new vacation request requires your approval:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Employee:</strong> ${request.requester.first_name} ${request.requester.last_name}</p>
              <p><strong>Team:</strong> ${request.team.name}</p>
              <p><strong>Date:</strong> ${dateStr}</p>
              <p><strong>Time:</strong> ${timeStr}</p>
              ${request.notes ? `<p><strong>Notes:</strong> ${request.notes}</p>` : ""}
            </div>
            
            <p>
              <a href="${approveUrl}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Request
              </a>
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              You're receiving this because you are a top-level planner/manager for ${approver.team_name}.
            </p>
          </div>
        `,
      });

      console.log(`Request notification sent to: ${approver.email}`);
    } else if (type === "approval" || type === "rejection") {
      const status = type === "approval" ? "Approved" : "Rejected";
      const dateStr = new Date(request.requested_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const timeStr = request.is_full_day
        ? "Full Day"
        : `${request.start_time} - ${request.end_time}`;

      await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [request.requester.email],
        subject: `Vacation Request ${status}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${type === "approval" ? "#22c55e" : "#ef4444"};">
              Vacation Request ${status}
            </h2>
            <p>Hello ${request.requester.first_name},</p>
            <p>Your vacation request has been <strong>${status.toLowerCase()}</strong>.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${dateStr}</p>
              <p><strong>Time:</strong> ${timeStr}</p>
              ${request.notes ? `<p><strong>Your Notes:</strong> ${request.notes}</p>` : ""}
              ${request.rejection_reason ? `<p><strong>Reason:</strong> ${request.rejection_reason}</p>` : ""}
            </div>
            
            ${type === "approval" ? 
              `<p style="color: #22c55e;">Your vacation has been added to the schedule.</p>` :
              `<p>If you have questions about this decision, please contact your manager.</p>`
            }
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Reviewed by: ${request.approver?.first_name} ${request.approver?.last_name}
            </p>
          </div>
        `,
      });

      console.log(`${status} notification sent to: ${request.requester.email}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in vacation-request-notification:", error);
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
