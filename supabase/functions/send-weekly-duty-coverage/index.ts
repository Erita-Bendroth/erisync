import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY') || '');

interface DutyCoverageRequest {
  template_id: string;
  week_number: number;
  year: number;
  preview?: boolean;
}

interface Assignment {
  user_id: string;
  substitute_user_id?: string;
  user?: { first_name: string; last_name: string; initials: string };
  substitute?: { first_name: string; last_name: string; initials: string };
  team_id: string;
  date?: string;
  duty_type?: string;
  source: 'manual' | 'schedule';
  shift_description?: string; // Extracted from schedule entry notes
}

interface TeamData {
  id: string;
  name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has appropriate role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = userRoles?.some(r => ['admin', 'planner', 'manager'].includes(r.role));
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { template_id, week_number, year, preview }: DutyCoverageRequest = await req.json();

    // Fetch duty template
    const { data: template, error: templateError } = await supabase
      .from('weekly_duty_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      console.error('Template fetch error:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Template fetched:', template.template_name);

    // Fetch team names for all teams in the template
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', template.team_ids);

    if (teamsError) {
      console.error('Teams fetch error:', teamsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teams: TeamData[] = teamsData || [];

    // Fetch team members to get region codes for teams
    const { data: teamMembersData } = await supabase
      .from('team_members')
      .select('team_id, user_id, profiles!inner(region_code)')
      .in('team_id', template.team_ids)
      .limit(1);

    // Map team_id to region_code (use first member's region as representative)
    const teamRegions: Record<string, string> = {};
    if (teamMembersData) {
      teamMembersData.forEach((tm: any) => {
        if (!teamRegions[tm.team_id] && tm.profiles?.region_code) {
          teamRegions[tm.team_id] = tm.profiles.region_code;
        }
      });
    }

    // Calculate week date range
    const startDate = new Date(year, 0, 1 + (week_number - 1) * 7);
    const dayOfWeek = startDate.getDay();
    const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    startDate.setDate(startDate.getDate() + diff);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    console.log('Week range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

    // Fetch manual duty assignments (overrides) for this template and week
    const { data: manualAssignmentsRaw, error: assignmentsError } = await supabase
      .from('duty_assignments')
      .select('*')
      .eq('week_number', week_number)
      .eq('year', year)
      .in('team_id', template.team_ids);

    if (assignmentsError) {
      console.error('Manual assignments fetch error:', assignmentsError);
    }

    // Get all unique user IDs from manual assignments
    const manualUserIds = new Set<string>();
    if (manualAssignmentsRaw) {
      manualAssignmentsRaw.forEach((assignment: any) => {
        if (assignment.user_id) manualUserIds.add(assignment.user_id);
        if (assignment.substitute_user_id) manualUserIds.add(assignment.substitute_user_id);
      });
    }

    // Fetch profiles for manual assignment users
    let manualProfiles: Record<string, any> = {};
    if (manualUserIds.size > 0) {
      const { data: profilesData } = await supabase
        .rpc('get_multiple_basic_profile_info', { 
          _user_ids: Array.from(manualUserIds) 
        });
      
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          manualProfiles[profile.user_id] = profile;
        });
      }
    }

    // Enrich manual assignments with profile data
    const manualAssignments = manualAssignmentsRaw?.map((assignment: any) => ({
      ...assignment,
      user: manualProfiles[assignment.user_id] || null,
      substitute: assignment.substitute_user_id ? manualProfiles[assignment.substitute_user_id] : null
    })) || [];

    // Fetch schedule entries for auto-pull
    const { data: scheduleEntriesRaw, error: scheduleError } = await supabase
      .from('schedule_entries')
      .select('*')
      .in('team_id', template.team_ids)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .eq('activity_type', 'work');

    if (scheduleError) {
      console.error('Schedule entries fetch error:', scheduleError);
    }

    // Get all unique user IDs from schedule entries
    const scheduleUserIds = new Set<string>();
    if (scheduleEntriesRaw) {
      scheduleEntriesRaw.forEach((entry: any) => {
        if (entry.user_id) scheduleUserIds.add(entry.user_id);
      });
    }

    // Fetch profiles for schedule users
    let scheduleProfiles: Record<string, any> = {};
    if (scheduleUserIds.size > 0) {
      const { data: profilesData } = await supabase
        .rpc('get_multiple_basic_profile_info', { 
          _user_ids: Array.from(scheduleUserIds) 
        });
      
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          scheduleProfiles[profile.user_id] = profile;
        });
      }
    }

    // Enrich schedule entries with profile data
    const scheduleEntries = scheduleEntriesRaw?.map((entry: any) => ({
      ...entry,
      user: scheduleProfiles[entry.user_id] || null
    })) || [];

    console.log('Fetched schedule entries:', scheduleEntries.length);

    // Combine manual assignments and schedule-based assignments
    const combinedAssignments = getCombinedAssignments(
      manualAssignments,
      scheduleEntries,
      template,
      startDate,
      endDate
    );

    console.log('Combined assignments:', combinedAssignments.length);

    // Fetch shift time definitions for descriptions
    const { data: shiftDefs } = await supabase
      .from('shift_time_definitions')
      .select('*');

    console.log('Fetched shift time definitions:', shiftDefs?.length || 0);

    if (preview) {
      const htmlContent = buildDutyCoverageEmail(template, combinedAssignments, teams);
      return new Response(
        JSON.stringify({ html: htmlContent }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate distribution list before sending
    if (!template.distribution_list || template.distribution_list.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients in distribution list. Please add email addresses to the template.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending to recipients:', template.distribution_list);

    // Generate email HTML and plain text
    const htmlContent = buildDutyCoverageEmail(template, combinedAssignments, teams);
    const textContent = buildPlainTextEmail(template, combinedAssignments, teams);

    // Send email via Resend using your verified domain
    const emailResult = await resend.emails.send({
      from: 'Weekly Duty Coverage <duty@erisync.xyz>',
      to: template.distribution_list,
      subject: `Weekly Duty Coverage - Week ${week_number}, ${year}`,
      html: htmlContent,
      text: textContent,
    });

    console.log('Email sent:', emailResult);

    // Get actual recipient count from result
    const actualRecipientCount = emailResult.error ? 0 : template.distribution_list.length;

    // Log email history
    await supabase.from('weekly_email_history').insert({
      template_id,
      week_number,
      year,
      sent_by: user.id,
      recipient_count: actualRecipientCount,
      status: emailResult.error ? 'failed' : 'success',
    });

    return new Response(
      JSON.stringify({ 
        success: !emailResult.error, 
        recipient_count: actualRecipientCount,
        data: emailResult 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to extract shift description from schedule entry notes
function extractShiftDescription(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined;
  
  // Pattern: "Auto-generated [Description] (HH:MM-HH:MM)"
  // Extract everything between "Auto-generated " and the time pattern
  const match = notes.match(/Auto-generated\s+(.+?)\s+\((\d{2}:\d{2}-\d{2}:\d{2})\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return undefined;
}

// Combine manual assignments with schedule-based assignments
function getCombinedAssignments(
  manualAssignments: any[],
  scheduleEntries: any[],
  template: any,
  startDate: Date,
  endDate: Date
): Assignment[] {
  const combined: Assignment[] = [];
  const manualMap = new Map<string, any>();

  // Index manual assignments by key (date + team_id + duty_type)
  manualAssignments.forEach(assignment => {
    const key = `${assignment.date}_${assignment.team_id}_${assignment.duty_type}`;
    manualMap.set(key, assignment);
  });

  // Process each day in the week for each team
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Process each team
    template.team_ids.forEach((teamId: string) => {
      // Check weekend duty
      if (template.include_weekend_duty && isWeekend) {
        const key = `${dateStr}_${teamId}_weekend`;
        if (manualMap.has(key)) {
          const manual = manualMap.get(key);
          combined.push({
            ...manual,
            source: 'manual'
          });
        } else {
          // Auto-pull from schedule
          const scheduleEntry = scheduleEntries.find(
            e => e.date === dateStr && e.team_id === teamId
          );
          if (scheduleEntry) {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'weekend',
              source: 'schedule',
              shift_description: extractShiftDescription(scheduleEntry.notes)
            } as Assignment);
          }
        }
      }

      // Check lateshift
      if (template.include_lateshift) {
        const key = `${dateStr}_${teamId}_lateshift`;
        if (manualMap.has(key)) {
          const manual = manualMap.get(key);
          combined.push({
            ...manual,
            source: 'manual'
          });
        } else {
          const scheduleEntry = scheduleEntries.find(
            e => e.date === dateStr && e.team_id === teamId && e.shift_type === 'late'
          );
          if (scheduleEntry) {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'lateshift',
              source: 'schedule',
              shift_description: extractShiftDescription(scheduleEntry.notes)
            } as Assignment);
          }
        }
      }

      // Check earlyshift
      if (template.include_earlyshift) {
        const key = `${dateStr}_${teamId}_earlyshift`;
        if (manualMap.has(key)) {
          const manual = manualMap.get(key);
          combined.push({
            ...manual,
            source: 'manual'
          });
        } else {
          const scheduleEntry = scheduleEntries.find(
            e => e.date === dateStr && e.team_id === teamId && e.shift_type === 'early'
          );
          if (scheduleEntry) {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'earlyshift',
              source: 'schedule',
              shift_description: extractShiftDescription(scheduleEntry.notes)
            } as Assignment);
          }
        }
      }
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return combined;
}

// Build the HTML email content with multi-team support
function buildDutyCoverageEmail(
  template: any,
  assignments: Assignment[],
  teams: TeamData[]
): string {
  // Get shift description for section title from actual assignments
  const getShiftDescForSection = (dutyAssignments: Assignment[]) => {
    const descriptions = new Set<string>();
    
    // Extract unique descriptions from assignments
    dutyAssignments.forEach(assignment => {
      if (assignment.shift_description) {
        descriptions.add(assignment.shift_description);
      }
    });

    if (descriptions.size === 0) return '';
    if (descriptions.size === 1) return ` - ${Array.from(descriptions)[0]}`;
    // Multiple descriptions - list them all
    return ` - ${Array.from(descriptions).join(', ')}`;
  };
  
  const weekendDuty = assignments.filter(a => a.duty_type === 'weekend');
  const lateshiftDuty = assignments.filter(a => a.duty_type === 'lateshift');
  const earlyshiftDuty = assignments.filter(a => a.duty_type === 'earlyshift');

  // Helper to build duty section with multi-team columns
  const buildDutySection = (title: string, dutyAssignments: Assignment[]) => {
    if (dutyAssignments.length === 0) return '';

    // Group by date
    const byDate: Record<string, Assignment[]> = {};
    dutyAssignments.forEach(assignment => {
      const date = assignment.date!;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(assignment);
    });

    const days = Object.keys(byDate).sort();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Build header row with team columns
    const headerCells = teams.map(team => `
      <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600;" colspan="2">${team.name}</th>
    `).join('');

    const subHeaderCells = teams.map(() => `
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 12px;">Assignment</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 12px;">Substitute</th>
    `).join('');

    const rows = days.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00Z');
      const dayName = dayNames[date.getUTCDay()];
      const dateAssignments = byDate[dateStr];
      
      // Create cells for each team
      const teamCells = teams.map(team => {
        const assignment = dateAssignments.find(a => a.team_id === team.id);
        const primaryInitials = assignment?.user?.initials || '-';
        const substituteInitials = assignment?.substitute?.initials || '-';
        const sourceIndicator = assignment?.source === 'schedule' ? '📅' : '';

        return `
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${sourceIndicator}${primaryInitials}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${substituteInitials}</td>
        `;
      }).join('');

      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${date.toLocaleDateString('en-GB')}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${dayName}</td>
          ${teamCells}
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; margin-bottom: 16px; font-size: 20px; font-weight: 600;">${title}</h2>
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600;" rowspan="2">Date</th>
              <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600;" rowspan="2">Weekday</th>
              ${headerCells}
            </tr>
            <tr style="background: #f9fafb;">
              ${subHeaderCells}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">📅 = Auto-populated from schedule</p>
      </div>
    `;
  };

  const weekendSection = template.include_weekend_duty ? buildDutySection(`Weekend/Public holiday duty${getShiftDescForSection(weekendDuty)}`, weekendDuty) : '';
  const lateshiftSection = template.include_lateshift ? buildDutySection(`Lateshift duty${getShiftDescForSection(lateshiftDuty)}`, lateshiftDuty) : '';
  const earlyshiftSection = template.include_earlyshift ? buildDutySection(`Earlyshift duty${getShiftDescForSection(earlyshiftDuty)}`, earlyshiftDuty) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Duty Coverage</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background: #f3f4f6; margin: 0; padding: 0;">
  <div style="max-width: 1000px; margin: 0 auto; padding: 24px;">
    <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #111827; margin-bottom: 24px; font-size: 28px; font-weight: 700;">Weekly Duty Coverage</h1>
      <p style="color: #6b7280; margin-bottom: 32px;">Template: <strong>${template.template_name}</strong></p>
      
      ${weekendSection}
      ${lateshiftSection}
      ${earlyshiftSection}
      
      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated email from EriSync Duty Coverage System.<br>
          <a href="mailto:support@erisync.xyz" style="color: #3b82f6; text-decoration: none;">Contact Support</a> | 
          <a href="https://ec7ff24a-66f9-44d2-a941-6025cf65938a.lovableproject.com" style="color: #3b82f6; text-decoration: none;">Manage Preferences</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Build plain text version of the email for better deliverability
function buildPlainTextEmail(
  template: any,
  assignments: Assignment[],
  teams: TeamData[]
): string {
  const weekendDuty = assignments.filter(a => a.duty_type === 'weekend');
  const lateshiftDuty = assignments.filter(a => a.duty_type === 'lateshift');
  const earlyshiftDuty = assignments.filter(a => a.duty_type === 'earlyshift');

  const buildPlainSection = (title: string, dutyAssignments: Assignment[]) => {
    if (dutyAssignments.length === 0) return '';

    const byDate: Record<string, Assignment[]> = {};
    dutyAssignments.forEach(assignment => {
      const date = assignment.date!;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(assignment);
    });

    const days = Object.keys(byDate).sort();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let text = `\n${title}\n${'='.repeat(title.length)}\n\n`;
    
    days.forEach(dateStr => {
      const date = new Date(dateStr + 'T00:00:00Z');
      const dayName = dayNames[date.getUTCDay()];
      text += `${date.toLocaleDateString('en-GB')} (${dayName})\n`;
      
      teams.forEach(team => {
        const assignment = byDate[dateStr].find(a => a.team_id === team.id);
        if (assignment) {
          const primary = assignment.user?.initials || '-';
          const substitute = assignment.substitute?.initials || '-';
          const source = assignment.source === 'schedule' ? ' [Auto]' : '';
          text += `  ${team.name}: ${primary} (Sub: ${substitute})${source}\n`;
        }
      });
      text += '\n';
    });

    return text;
  };

  let plainText = `WEEKLY DUTY COVERAGE\nTemplate: ${template.template_name}\n\n`;
  
  if (template.include_weekend_duty) {
    plainText += buildPlainSection('WEEKEND/PUBLIC HOLIDAY DUTY', weekendDuty);
  }
  if (template.include_lateshift) {
    plainText += buildPlainSection('LATESHIFT DUTY', lateshiftDuty);
  }
  if (template.include_earlyshift) {
    plainText += buildPlainSection('EARLYSHIFT DUTY', earlyshiftDuty);
  }

  plainText += '\n[Auto] = Auto-populated from schedule\n\n';
  plainText += '---\n';
  plainText += 'This is an automated email from EriSync Duty Coverage System.\n';
  plainText += 'Contact: support@erisync.xyz\n';

  return plainText;
}
