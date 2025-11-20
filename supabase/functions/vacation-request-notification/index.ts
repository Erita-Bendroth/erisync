import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Input validation schema
const notificationSchema = z.object({
  requestId: z.string().uuid(),
  type: z.enum(["request", "approval", "rejection"]),
  groupId: z.string().uuid().optional().nullable(),
});

// Error sanitizer
function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Invalid input: " + error.errors.map(e => e.message).join(", ");
  }
  console.error("Internal error:", error);
  return "Operation failed. Please try again.";
}

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

interface VacationRequestNotification {
  requestId: string;
  type: "request" | "approval" | "rejection";
  groupId?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { requestId, type, groupId } = notificationSchema.parse(body);

    console.log(`Processing vacation ${type} notification for request: ${requestId}${groupId ? ` (group: ${groupId})` : ''}`);

    // Fetch all requests in the group (or just the single request)
    let requestsQuery = supabase
      .from("vacation_requests")
      .select(`
        *,
        requester:profiles!vacation_requests_user_id_fkey(first_name, last_name, email),
        approver:profiles!vacation_requests_approver_id_fkey(first_name, last_name, email),
        team:teams(name)
      `);

    if (groupId) {
      requestsQuery = requestsQuery.eq("request_group_id", groupId);
    } else {
      requestsQuery = requestsQuery.eq("id", requestId);
    }

    const { data: requests, error: requestError } = await requestsQuery;

    if (requestError || !requests || requests.length === 0) {
      throw new Error(`Failed to fetch request(s): ${requestError?.message}`);
    }

    // Use the first request for common data
    const request = requests[0];
    const isMultiDay = requests.length > 1;

    // Verify caller has permission (requester, approver, or privileged role)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPrivilegedRole = roles?.some(r => ['admin', 'planner'].includes(r.role));
    const isRequester = request.user_id === user.id;
    const isApprover = request.selected_planner_id === user.id || request.approver_id === user.id;

    if (!hasPrivilegedRole && !isRequester && !isApprover) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to send this notification' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get date range info
    const dates = requests.map(r => new Date(r.requested_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    if (type === "request") {
      // Get the team manager's information
      const { data: manager, error: managerError } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", request.selected_planner_id)
        .single();

      if (managerError || !manager) {
        console.error("Failed to find team manager:", managerError);
        throw new Error(`Failed to find team manager: ${managerError?.message}`);
      }

      const dateStr = isMultiDay
        ? `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : startDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      const timeStr = request.is_full_day
        ? "Full Day"
        : `${request.start_time} - ${request.end_time}`;

      const durationStr = isMultiDay ? ` (${dates.length} working days)` : "";
      // Use production domain for approval URL (erisync.xyz)
      const approveUrl = `https://erisync.xyz/schedule?pendingApproval=${requestId}`;

      // Send notification to the team manager
      await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [manager.email],
        subject: `New Vacation Request - ${request.requester.first_name} ${request.requester.last_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Vacation Request</h2>
            <p>Hello ${manager.first_name},</p>
            <p>A team member has submitted a vacation request for your review:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Employee:</strong> ${request.requester.first_name} ${request.requester.last_name}</p>
              <p><strong>Team:</strong> ${request.team.name}</p>
              <p><strong>Date${isMultiDay ? 's' : ''}:</strong> ${dateStr}${durationStr}</p>
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
              As the team manager, you can review and approve/reject this request through the EriSync dashboard.
            </p>
          </div>
        `,
      });

      console.log(`Request notification sent to manager: ${manager.email}`);
    } else if (type === "approval") {
      const dateStr = isMultiDay
        ? `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : startDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      const timeStr = request.is_full_day
        ? "Full Day"
        : `${request.start_time} - ${request.end_time}`;

      const durationStr = isMultiDay ? ` (${dates.length} working days)` : "";

      // Send approval notification to requester
      await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [request.requester.email],
        subject: `Vacation Request Approved`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">Vacation Request Approved</h2>
            <p>Hello ${request.requester.first_name},</p>
            <p>Your vacation request has been <strong>approved</strong>.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date${isMultiDay ? 's' : ''}:</strong> ${dateStr}${durationStr}</p>
              <p><strong>Time:</strong> ${timeStr}</p>
              ${request.notes ? `<p><strong>Your Notes:</strong> ${request.notes}</p>` : ""}
            </div>
            
            <p style="color: #22c55e;">Your vacation has been added to the schedule and all other shifts for ${isMultiDay ? 'these dates' : 'this date'} have been removed.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Approved by: ${request.approver?.first_name} ${request.approver?.last_name}
            </p>
          </div>
        `,
      });

      console.log(`Approval notification sent to requester: ${request.requester.email}`);

      // Get the manager for the employee's team and send notification
      const { data: teamMember, error: tmError } = await supabase
        .from("team_members")
        .select(`
          team_id,
          is_manager,
          profiles!team_members_user_id_fkey(first_name, last_name, email)
        `)
        .eq("team_id", request.team_id)
        .eq("is_manager", true)
        .limit(1)
        .single();

      if (!tmError && teamMember && teamMember.profiles) {
        await resend.emails.send({
          from: "EriSync <noreply@erisync.xyz>",
          to: [teamMember.profiles.email],
          subject: `Team Member Vacation Approved: ${request.requester.first_name} ${request.requester.last_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Team Member Vacation Approved</h2>
              <p>Hello ${teamMember.profiles.first_name},</p>
              <p>A vacation request for your team member has been approved by their manager:</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Employee:</strong> ${request.requester.first_name} ${request.requester.last_name}</p>
                <p><strong>Team:</strong> ${request.team.name}</p>
                <p><strong>Date${isMultiDay ? 's' : ''}:</strong> ${dateStr}${durationStr}</p>
                <p><strong>Time:</strong> ${timeStr}</p>
                ${request.notes ? `<p><strong>Notes:</strong> ${request.notes}</p>` : ""}
              </div>
              
              <p>The vacation has been added to the schedule.</p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Approved by: ${request.approver?.first_name} ${request.approver?.last_name}
              </p>
            </div>
          `,
        });

        console.log(`Manager notification sent to: ${teamMember.profiles.email}`);
      }
    } else if (type === "rejection") {
      const dateStr = isMultiDay
        ? `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : startDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      const timeStr = request.is_full_day
        ? "Full Day"
        : `${request.start_time} - ${request.end_time}`;

      const durationStr = isMultiDay ? ` (${dates.length} working days)` : "";

      await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [request.requester.email],
        subject: `Vacation Request Rejected`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Vacation Request Rejected</h2>
            <p>Hello ${request.requester.first_name},</p>
            <p>Your vacation request has been <strong>rejected</strong>.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date${isMultiDay ? 's' : ''}:</strong> ${dateStr}${durationStr}</p>
              <p><strong>Time:</strong> ${timeStr}</p>
              ${request.notes ? `<p><strong>Your Notes:</strong> ${request.notes}</p>` : ""}
              ${request.rejection_reason ? `<p><strong>Reason:</strong> ${request.rejection_reason}</p>` : ""}
            </div>
            
            <p>If you have questions about this decision, please contact your planner or manager.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Reviewed by: ${request.approver?.first_name} ${request.approver?.last_name}
            </p>
          </div>
        `,
      });

      console.log(`Rejection notification sent to: ${request.requester.email}`);
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
    const sanitized = sanitizeError(error);
    console.error("Error in vacation-request-notification:", error);
    return new Response(
      JSON.stringify({ error: sanitized }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
