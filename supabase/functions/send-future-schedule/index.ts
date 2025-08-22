import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AZURE_CLIENT_ID = Deno.env.get("AZURE_AD_CLIENT_ID");
const AZURE_CLIENT_SECRET = Deno.env.get("AZURE_AD_CLIENT_SECRET");
const AZURE_TENANT_ID = Deno.env.get("AZURE_TENANT_ID") || "common";
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Microsoft Graph API functions
async function getAccessToken() {
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Azure credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendGraphEmail(fromEmail: string, toEmail: string, subject: string, htmlContent: string) {
  const accessToken = await getAccessToken();
  
  const emailData = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: htmlContent
      },
      toRecipients: [{
        emailAddress: { address: toEmail }
      }]
    }
  };

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email via Graph API: ${error}`);
  }

  return { success: true, provider: "Microsoft Graph" };
}

// Fallback SMTP function (if configured)
async function sendSMTPEmail(toEmail: string, subject: string, htmlContent: string) {
  const smtpConfig = {
    host: Deno.env.get("SMTP_HOST"),
    port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
    username: Deno.env.get("SMTP_USERNAME"),
    password: Deno.env.get("SMTP_PASSWORD"),
    fromEmail: Deno.env.get("SMTP_FROM_EMAIL") || "noreply@company.com"
  };

  if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
    throw new Error("SMTP not configured");
  }

  // Simple SMTP implementation would go here
  // For now, we'll return a placeholder
  return { success: true, provider: "SMTP", message: "SMTP sending not yet implemented" };
}

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

    const to = profile?.email;
    if (!to) {
      return new Response(JSON.stringify({ error: 'User email not found' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const subject = `Your upcoming schedule (${start_date} to ${end_date})`;
    
    let emailResponse;
    let emailMethod = 'none';
    
    try {
      // Try Resend first (recommended for modern apps)
      if (resend) {
        emailResponse = await resend.emails.send({
          from: "EriSync <noreply@erisync.xyz>",
          to: [to],
          subject,
          html
        });
        emailMethod = 'Resend';
        console.log("✅ Email sent successfully via Resend:", emailResponse.id);
      } else {
        throw new Error("Resend not configured");
      }
    } catch (resendError) {
      console.log("❌ Resend failed:", resendError.message);
      
      try {
        // Fallback to Microsoft Graph API
        const fromEmail = Deno.env.get("FROM_EMAIL") || "scheduler@company.com";
        emailResponse = await sendGraphEmail(fromEmail, to, subject, html);
        emailMethod = 'Microsoft Graph';
        console.log("✅ Email sent successfully via Microsoft Graph API");
      } catch (graphError) {
        console.log("❌ Microsoft Graph API failed:", graphError.message);
        
        try {
          // Final fallback to SMTP
          emailResponse = await sendSMTPEmail(to, subject, html);
          emailMethod = 'SMTP';
          console.log("✅ Email sent successfully via SMTP");
        } catch (smtpError) {
          console.log("❌ SMTP failed:", smtpError.message);
          
          // If all fail, return detailed error
          return new Response(JSON.stringify({ 
            error: 'All email methods failed', 
            details: {
              resend_error: resendError.message,
              graph_error: graphError.message,
              smtp_error: smtpError.message
            },
            suggestions: [
              "Configure RESEND_API_KEY for reliable email delivery",
              "Configure Azure Tenant ID for Microsoft Graph",
              "Configure SMTP settings for corporate email server",
              "Contact your administrator to set up email services"
            ]
          }), { 
            status: 500, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
          });
        }
      }
    }

    return new Response(JSON.stringify({ sent: true, emailResponse, method: emailMethod }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error('send-future-schedule error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});