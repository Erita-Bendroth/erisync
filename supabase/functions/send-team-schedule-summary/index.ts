import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface TeamPayload {
  team_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

function getDefaultTimes(shift: string) {
  switch (shift) {
    case "early": return { start_time: "06:00", end_time: "14:30" };
    case "late": return { start_time: "13:00", end_time: "21:30" };
    default: return { start_time: "08:00", end_time: "16:30" };
  }
}

function displayName(activity: string) {
  switch (activity) {
    case "work": return "Work";
    case "vacation": return "Vacation";
    case "sick": return "Sick Leave";
    case "training": return "Training";
    case "hotline_support": return "Hotline Support";
    case "out_of_office": return "Out of Office";
    case "flextime": return "Flextime";
    case "working_from_home": return "Working from Home";
    default: return activity.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

function parseBlocks(entry: any) {
  const pattern = /Times:\s*(.+)/;
  const match = entry.notes?.match(pattern);
  if (match) {
    try {
      const arr = JSON.parse(match[1]);
      if (Array.isArray(arr)) return arr;
    } catch (_) {}
  }
  const d = getDefaultTimes(entry.shift_type);
  return [{ activity_type: entry.activity_type, start_time: d.start_time, end_time: d.end_time }];
}

function buildHtml(fullName: string, itemsByDate: Record<string, any[]>) {
  const rows = Object.keys(itemsByDate).sort().map((date) => {
    const items = itemsByDate[date]
      .map((it) => `${displayName(it.activity_type)} ${it.start_time}–${it.end_time}`)
      .join("<br/>");
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${date}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${items}</td></tr>`;
  }).join("");

  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif">
    <h2 style="margin:0 0 12px">Your Upcoming Schedule (Next 2 weeks)</h2>
    <p style="color:#555">Hello ${fullName}, here is your upcoming schedule summary for the next two weeks.</p>
    <table style="border-collapse:collapse;width:100%;margin-top:16px">
      <thead>
        <tr>
          <th align="left" style="padding:12px;border-bottom:2px solid #333;background:#f8f9fa">Date</th>
          <th align="left" style="padding:12px;border-bottom:2px solid #333;background:#f8f9fa">Shifts</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="2" style="padding:16px;color:#777;text-align:center">No shifts scheduled in this period.</td></tr>'}</tbody>
    </table>
    <p style="color:#666;margin-top:24px;font-size:14px">This summary was sent by your planner. If you have questions about your schedule, please contact your manager.</p>
    <p style="color:#777;margin-top:8px;font-size:12px">Sent by EriSync Scheduling System</p>
  </div>`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with the user's token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify the user is authenticated and has appropriate role
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if user has manager, planner, or admin role
    const { data: roles, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles?.some(r => ['manager', 'planner', 'admin'].includes(r.role))) {
      console.error('Authorization error: User does not have required role');
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const { team_id, start_date, end_date }: TeamPayload = await req.json();

    if (!team_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    if (!resend) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    console.log(`📧 Sending team schedule summaries for team: ${team_id}`);

    // Get team members with their profiles
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        profiles!team_members_user_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .eq('team_id', team_id);

    if (teamError) {
      console.error('Failed to fetch team members:', teamError);
      throw teamError;
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const member of teamMembers || []) {
      const profile = member.profiles;
      if (!profile) {
        console.warn(`Skipping member with no profile: ${member.user_id}`);
        continue;
      }

      const fullName = `${profile.first_name} ${profile.last_name}`.trim();
      console.log(`📧 Processing ${fullName} (${profile.email})...`);

      try {
        // Fetch schedule entries for this user
        const { data: entries, error: scheduleError } = await supabase
          .from('schedule_entries')
          .select('id,date,shift_type,activity_type,notes')
          .eq('user_id', member.user_id)
          .gte('date', start_date)
          .lte('date', end_date)
          .order('date');

        if (scheduleError) {
          console.error(`❌ Failed to fetch schedule for ${fullName}:`, scheduleError);
          results.push({
            user_id: member.user_id,
            email: profile.email,
            name: fullName,
            success: false,
            error: `Schedule fetch error: ${scheduleError.message}`
          });
          errorCount++;
          continue;
        }

        // Group by date with parsed blocks
        const byDate: Record<string, any[]> = {};
        for (const entry of entries || []) {
          const blocks = parseBlocks(entry);
          if (!byDate[entry.date]) byDate[entry.date] = [];
          byDate[entry.date].push(...blocks);
        }

        const html = buildHtml(fullName, byDate);
        const subject = `Your upcoming schedule (${start_date} to ${end_date})`;

        // Send email
        const emailResponse = await resend.emails.send({
          from: "EriSync <noreply@erisync.xyz>",
          to: [profile.email],
          subject,
          html
        });

        console.log(`✅ Email sent to ${fullName}: ${emailResponse.id || 'success'}`);
        results.push({
          user_id: member.user_id,
          email: profile.email,
          name: fullName,
          success: true
        });
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        console.error(`❌ Failed to send email to ${fullName}:`, error);
        results.push({
          user_id: member.user_id,
          email: profile.email,
          name: fullName,
          success: false,
          error: error.message || 'Unknown error'
        });
        errorCount++;
      }
    }

    const summary = {
      team_id,
      total_members: teamMembers?.length || 0,
      emails_sent: successCount,
      errors: errorCount,
      date_range: `${start_date} to ${end_date}`,
      results
    };

    console.log(`📊 Team email batch complete: ${successCount} sent, ${errorCount} errors`);
    
    return new Response(JSON.stringify(summary), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });

  } catch (error: any) {
    console.error('💥 Team schedule summary failed:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }
});