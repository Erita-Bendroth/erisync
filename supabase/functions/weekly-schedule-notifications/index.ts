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

interface SendResult {
  user_id: string;
  email: string;
  name: string;
  success: boolean;
  error?: string;
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
    <p style="color:#666;margin-top:24px;font-size:14px">This is an automated weekly summary sent every Monday. If you have questions about your schedule, please contact your manager or planner.</p>
    <p style="color:#777;margin-top:8px;font-size:12px">Sent by EriSync Scheduling System</p>
  </div>`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("🚀 Starting weekly schedule notifications job...");

    if (!resend) {
      console.error("❌ Email service not configured - RESEND_API_KEY missing");
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Get date range - next 2 weeks from today
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 13); // 2 weeks
    const start_date = start.toISOString().split('T')[0];
    const end_date = end.toISOString().split('T')[0];

    console.log(`📅 Date range: ${start_date} to ${end_date}`);

    // Get all active users with roles (excluding pure team members for now, they get too many emails)
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        first_name,
        last_name,
        email,
        user_roles!inner(role)
      `)
      .in('user_roles.role', ['planner', 'manager']) // Only send to planners and managers for now
      .order('first_name');

    if (usersError) {
      console.error("❌ Failed to fetch eligible users:", usersError);
      throw usersError;
    }

    console.log(`👥 Found ${eligibleUsers?.length || 0} eligible users for notifications`);

    const results: SendResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of eligibleUsers || []) {
      const fullName = `${user.first_name} ${user.last_name}`.trim();
      console.log(`📧 Processing ${fullName} (${user.email})...`);

      try {
        // Fetch schedule entries for this user
        const { data: entries, error: scheduleError } = await supabase
          .from('schedule_entries')
          .select('id,date,shift_type,activity_type,notes')
          .eq('user_id', user.user_id)
          .gte('date', start_date)
          .lte('date', end_date)
          .order('date');

        if (scheduleError) {
          console.error(`❌ Failed to fetch schedule for ${fullName}:`, scheduleError);
          results.push({
            user_id: user.user_id,
            email: user.email,
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
          to: [user.email],
          subject,
          html
        });

        console.log(`✅ Email sent to ${fullName}: ${emailResponse.id || 'success'}`);
        results.push({
          user_id: user.user_id,
          email: user.email,
          name: fullName,
          success: true
        });
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`❌ Failed to send email to ${fullName}:`, error);
        results.push({
          user_id: user.user_id,
          email: user.email,
          name: fullName,
          success: false,
          error: error.message || 'Unknown error'
        });
        errorCount++;
      }
    }

    const summary = {
      total_users: eligibleUsers?.length || 0,
      emails_sent: successCount,
      errors: errorCount,
      date_range: `${start_date} to ${end_date}`,
      results
    };

    console.log(`📊 Weekly notifications complete: ${successCount} sent, ${errorCount} errors`);
    
    return new Response(JSON.stringify(summary), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });

  } catch (error: any) {
    console.error('💥 Weekly notifications job failed:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }
});