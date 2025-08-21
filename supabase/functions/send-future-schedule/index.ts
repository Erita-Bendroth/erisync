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

interface Payload {
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  preview?: boolean;
}

function getDefaultTimes(shift: string) {
  switch (shift) {
    case "early":
      return { start_time: "06:00", end_time: "14:30" };
    case "late":
      return { start_time: "13:00", end_time: "21:30" };
    default:
      return { start_time: "08:00", end_time: "16:30" };
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
      if (Array.isArray(arr)) return arr; // expects [{activity_type,start_time,end_time}]
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
    <h2 style="margin:0 0 12px">Upcoming Schedule (2 weeks)</h2>
    <p style="color:#555">Hello ${fullName}, here is your upcoming schedule summary.</p>
    <table style="border-collapse:collapse;width:100%;margin-top:8px">
      <thead>
        <tr>
          <th align="left" style="padding:8px 12px;border-bottom:2px solid #333">Date</th>
          <th align="left" style="padding:8px 12px;border-bottom:2px solid #333">Shifts</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="2" style="padding:12px;color:#777">No shifts in this period.</td></tr>'}</tbody>
    </table>
    <p style="color:#777;margin-top:16px">Sent by EriSync</p>
  </div>`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, start_date, end_date, preview }: Payload = await req.json();

    if (!user_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Fetch profile for name/email
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('user_id', user_id)
      .maybeSingle();
    if (pErr) throw pErr;

    // Fetch schedule entries in range
    const { data: entries, error: sErr } = await supabase
      .from('schedule_entries')
      .select('id,date,shift_type,activity_type,notes')
      .eq('user_id', user_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date');
    if (sErr) throw sErr;

    // Group by date with parsed blocks
    const byDate: Record<string, any[]> = {};
    for (const e of entries || []) {
      const blocks = parseBlocks(e);
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(...blocks);
    }

    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'there';
    const html = buildHtml(fullName, byDate);

    if (preview) {
      return new Response(JSON.stringify({ html }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!resend) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const to = profile?.email;
    if (!to) {
      return new Response(JSON.stringify({ error: 'User email not found' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const subject = `Your upcoming schedule (${start_date} to ${end_date})`;
    const emailResponse = await resend.emails.send({ from: "EriSync <onboarding@resend.dev>", to: [to], subject, html });

    return new Response(JSON.stringify({ sent: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error('send-future-schedule error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});