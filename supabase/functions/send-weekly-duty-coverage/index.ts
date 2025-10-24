import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface DutyCoverageRequest {
  template_id: string;
  week_number: number;
  year: number;
  preview?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is manager, planner, or admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = roles?.some(r => ['admin', 'planner', 'manager'].includes(r.role));
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { template_id, week_number, year, preview = false }: DutyCoverageRequest = await req.json();

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('weekly_duty_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate week start and end dates
    const firstDayOfYear = new Date(year, 0, 1);
    const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const weekStart = new Date(firstMonday.getTime() + (week_number - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Fetch duty assignments for this week
    const { data: assignments } = await supabase
      .from('duty_assignments')
      .select('*, user:user_id(first_name, last_name, initials), substitute:substitute_user_id(first_name, last_name, initials)')
      .eq('team_id', template.team_id)
      .eq('year', year)
      .eq('week_number', week_number);

    // Fetch schedule entries for context
    const { data: scheduleEntries } = await supabase
      .from('schedule_entries')
      .select('*, user:user_id(first_name, last_name, initials)')
      .eq('team_id', template.team_id)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]);

    // Build HTML email
    const html = buildDutyCoverageEmail(template, assignments || [], scheduleEntries || [], week_number, year, weekStart, weekEnd);

    if (preview) {
      return new Response(JSON.stringify({ html, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send emails
    const recipients = template.distribution_list;
    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        await resend.emails.send({
          from: 'Shift Management <onboarding@resend.dev>',
          to: [recipient],
          subject: `${template.template_name} Duty Coverage - Week ${week_number}, ${year}`,
          html,
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient}:`, error);
        failCount++;
      }
    }

    // Log to history
    await supabase.from('weekly_email_history').insert({
      template_id,
      week_number,
      year,
      sent_by: user.id,
      recipient_count: recipients.length,
      status: failCount === 0 ? 'success' : failCount === recipients.length ? 'failed' : 'partial',
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        total: recipients.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-weekly-duty-coverage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildDutyCoverageEmail(
  template: any,
  assignments: any[],
  scheduleEntries: any[],
  weekNumber: number,
  year: number,
  weekStart: Date,
  weekEnd: Date
): string {
  const weekendAssignments = assignments.filter(a => a.duty_type === 'weekend');
  const lateshiftAssignments = assignments.filter(a => a.duty_type === 'lateshift');
  const earlyshiftAssignments = assignments.filter(a => a.duty_type === 'earlyshift');

  const days = [];
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    table { border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #d0d0d0; padding: 6px 10px; text-align: left; }
    th { background: #B4C7E7; font-weight: bold; }
    .header { background: #4472C4; color: white; font-weight: bold; }
    .weekend { background: #FFF2CC; }
  </style>
</head>
<body>
  <h3>Hi All,</h3>
  <p>Below is the ${template.template_name} duty for week ${weekNumber}. The team are available, as shown below, to handle and support on stopped turbines:</p>
  
  <table style="width: 300px;">
    <tr class="header">
      <th colspan="2">Duty Overview ${year}</th>
    </tr>
    <tr>
      <th>Year</th>
      <th>Week</th>
    </tr>
    <tr>
      <td>${year}</td>
      <td>${weekNumber}</td>
    </tr>
  </table>

  ${template.include_weekend_duty ? `
  <h4>Weekend/Public holiday duty</h4>
  <table style="width: 100%;">
    <thead>
      <tr>
        <th>Date</th>
        <th>Weekday</th>
        <th>Duty Assignment</th>
        <th>Substitute</th>
      </tr>
    </thead>
    <tbody>
      ${days.filter(d => d.getDay() === 0 || d.getDay() === 6).map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const assignment = weekendAssignments.find(a => a.date === dateStr);
        return `
        <tr class="weekend">
          <td>${day.toLocaleDateString('en-GB')}</td>
          <td>${dayNames[day.getDay()]}</td>
          <td>${assignment ? (assignment.user?.initials || assignment.user?.first_name || '-') : '-'}</td>
          <td>${assignment?.substitute ? (assignment.substitute.initials || assignment.substitute.first_name || '-') : '-'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  ${template.include_lateshift ? `
  <h4>Lateshift (14:00-20:00)</h4>
  <table style="width: 100%;">
    <thead>
      <tr>
        <th>Date</th>
        <th>Weekday</th>
        <th>Duty Assignment</th>
        <th>Substitute</th>
      </tr>
    </thead>
    <tbody>
      ${days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const assignment = lateshiftAssignments.find(a => a.date === dateStr);
        return `
        <tr>
          <td>${day.toLocaleDateString('en-GB')}</td>
          <td>${dayNames[day.getDay()]}</td>
          <td>${assignment ? (assignment.user?.initials || assignment.user?.first_name || '-') : '-'}</td>
          <td>${assignment?.substitute ? (assignment.substitute.initials || assignment.substitute.first_name || '-') : '-'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  ${template.include_earlyshift ? `
  <h4>Earlyshift (06:00-14:00)</h4>
  <table style="width: 100%;">
    <thead>
      <tr>
        <th>Date</th>
        <th>Weekday</th>
        <th>Duty Assignment</th>
        <th>Substitute</th>
      </tr>
    </thead>
    <tbody>
      ${days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const assignment = earlyshiftAssignments.find(a => a.date === dateStr);
        return `
        <tr>
          <td>${day.toLocaleDateString('en-GB')}</td>
          <td>${dayNames[day.getDay()]}</td>
          <td>${assignment ? (assignment.user?.initials || assignment.user?.first_name || '-') : '-'}</td>
          <td>${assignment?.substitute ? (assignment.substitute.initials || assignment.substitute.first_name || '-') : '-'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  <h4>Time Legend</h4>
  <table>
    <tr><td>06:00-14:00</td><td>Early shift (DK, UK, IE, NO, PL)</td></tr>
    <tr><td>06:00-14:30</td><td>Early shift (SE, FI)</td></tr>
    <tr><td>14:00-20:00</td><td>Late shift</td></tr>
  </table>

  <p>Best regards,<br>Shift Management System</p>
</body>
</html>`;
}
