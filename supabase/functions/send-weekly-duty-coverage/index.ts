import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { buildCustomEmailHtml } from './custom-email-builder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the start date (Monday) of the specified ISO week
function getISOWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4)); // January 4th is always in week 1
  const jan4Day = jan4.getUTCDay() || 7; // Sunday is 7, not 0
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - (jan4Day - 1)); // Go back to Monday of week 1
  weekStart.setUTCDate(weekStart.getUTCDate() + (week - 1) * 7); // Add weeks
  return weekStart;
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY') || '');

interface DutyCoverageRequest {
  template_id: string;
  week_number: number;
  year: number;
  preview?: boolean;
  return_structured_data?: boolean;
}

interface Assignment {
  user_id: string;
  substitute_user_id?: string;
  user?: { first_name: string; last_name: string; initials: string; country_code?: string };
  substitute?: { first_name: string; last_name: string; initials: string; country_code?: string };
  team_id: string;
  date?: string;
  duty_type?: string;
  source: 'manual' | 'schedule';
  responsibility_region?: string;
}

interface TeamData {
  id: string;
  name: string;
}

interface ConsolidatedTeam {
  displayName: string;
  teamIds: string[];
  category: string;
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

    // Create client with service role key to bypass RLS for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create anon client for auth check only
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

    const { template_id, week_number, year, preview, return_structured_data }: DutyCoverageRequest = await req.json();

    // Fetch duty template
    const { data: template, error: templateError } = await supabaseServiceRole
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
    const { data: teamsData, error: teamsError } = await supabaseServiceRole
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

    // Calculate week date range using ISO week calculation
    const startDate = getISOWeekStartDate(year, week_number);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);

    console.log('Week range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

    // Fetch manual duty assignments (overrides) for this template and week
    const { data: manualAssignmentsRaw, error: assignmentsError } = await supabaseServiceRole
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

    // Fetch profiles for manual assignment users with country codes
    let manualProfiles: Record<string, any> = {};
    if (manualUserIds.size > 0) {
      const { data: profilesData } = await supabaseServiceRole
        .from('profiles')
        .select('user_id, first_name, last_name, initials, country_code')
        .in('user_id', Array.from(manualUserIds));
      
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
    const { data: scheduleEntriesRaw, error: scheduleError } = await supabaseServiceRole
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
    scheduleEntriesRaw?.forEach((entry: any) => {
      if (entry.user_id) scheduleUserIds.add(entry.user_id);
    });

    // Fetch profiles for schedule assignment users with country codes
    let scheduleProfiles: Record<string, any> = {};
    if (scheduleUserIds.size > 0) {
      const { data: profilesData } = await supabaseServiceRole
        .from('profiles')
        .select('user_id, first_name, last_name, initials, country_code')
        .in('user_id', Array.from(scheduleUserIds));
      
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
    const { data: shiftDefs } = await supabaseServiceRole
      .from('shift_time_definitions')
      .select('*');

    console.log('Fetched shift time definitions:', shiftDefs?.length || 0);

    // Check for custom layout template - use order + limit instead of single to handle duplicates
    const { data: customTemplateArray, error: customError } = await supabaseServiceRole
      .from('custom_duty_email_templates')
      .select('*')
      .eq('source_template_id', template_id)
      .eq('week_number', week_number)
      .eq('year', year)
      .eq('mode', 'hybrid')
      .order('updated_at', { ascending: false })
      .limit(1);

    const customTemplate = customTemplateArray?.[0] || null;

    if (customError) {
      console.error('Error fetching custom template:', customError);
    }

    console.log('Custom template query result:', {
      found: !!customTemplate,
      template_id,
      week_number,
      year,
      customTemplateId: customTemplate?.id,
      hasTemplateData: !!customTemplate?.template_data,
      arrayLength: customTemplateArray?.length || 0
    });

    if (preview) {
      if (return_structured_data) {
        console.log('Returning structured data with', combinedAssignments.length, 'assignments');
        console.log('Sample assignment:', combinedAssignments[0]);
        return new Response(
          JSON.stringify({ assignments: combinedAssignments }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Always generate auto tables first
      let htmlContent = buildDutyCoverageEmail(template, combinedAssignments, teams, shiftDefs || []);
      
      // Append custom content if exists
      if (customTemplate?.template_data) {
        const customHtml = buildCustomEmailHtml(customTemplate.template_name, week_number, customTemplate.template_data);
        const customBodyMatch = customHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const customContent = customBodyMatch ? customBodyMatch[1] : customHtml;
        
        htmlContent = htmlContent.replace(
          '</div>\n  </div>\n</body>',
          `</div>\n      <hr style="border: 0; border-top: 2px solid #e5e7eb; margin: 32px 0;" />\n      <div style="margin-top: 32px;">\n        <h2 style="color: #111827; margin-bottom: 16px; font-size: 24px; font-weight: 600;">Additional Information</h2>\n        ${customContent}\n      </div>\n    </div>\n  </div>\n</body>`
        );
      }
      
      return new Response(
        JSON.stringify({ html: htmlContent }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email HTML - always start with auto-generated tables
    let htmlContent = buildDutyCoverageEmail(template, combinedAssignments, teams, shiftDefs || []);
    
    // Append custom content if exists
    if (customTemplate?.template_data) {
      const customHtml = buildCustomEmailHtml(customTemplate.template_name, week_number, customTemplate.template_data, preview);
      const customBodyMatch = customHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const customContent = customBodyMatch ? customBodyMatch[1] : customHtml;
      
      htmlContent = htmlContent.replace(
        '</div>\n  </div>\n</body>',
        `</div>\n      <hr style="border: 0; border-top: 2px solid #e5e7eb; margin: 32px 0;" />\n      <div style="margin-top: 32px;">\n        <h2 style="color: #111827; margin-bottom: 16px; font-size: 24px; font-weight: 600;">Additional Information</h2>\n        ${customContent}\n      </div>\n    </div>\n  </div>\n</body>`
      );
    }

    // Process screenshots as inline attachments using public URLs
    const attachments = [];
    if (customTemplate?.template_data?.screenshots) {
      for (const screenshot of customTemplate.template_data.screenshots) {
        try {
          // Extract the path from the full URL
          const urlParts = screenshot.url.split('/email-screenshots/');
          if (urlParts.length === 2) {
            const filePath = urlParts[1];
            
            // Get public URL from Supabase Storage
            const { data: publicUrlData } = supabaseServiceRole
              .storage
              .from('email-screenshots')
              .getPublicUrl(filePath);
            
            if (publicUrlData?.publicUrl) {
              // Determine file extension
              const extension = screenshot.name.split('.').pop()?.toLowerCase() || 'png';
              
              // Use Resend's path property with public URL
              attachments.push({
                path: publicUrlData.publicUrl,
                filename: `${screenshot.id}.${extension}`,
                contentId: screenshot.id,
              });
              
              console.log('Added screenshot attachment:', {
                name: screenshot.name,
                contentId: screenshot.id,
                publicUrl: publicUrlData.publicUrl
              });
            } else {
              console.error('Could not get public URL for screenshot:', screenshot.name);
            }
          }
        } catch (err) {
          console.error('Error processing screenshot:', screenshot.name, err);
        }
      }
    }

    // Log attachment details for debugging
    console.log('Attachments count:', attachments.length);
    if (attachments.length > 0) {
      console.log('Attachment details:', attachments.map(att => ({
        filename: att.filename,
        contentId: att.contentId,
        contentType: att.content_type,
        base64Length: att.content.length,
        base64Preview: att.content.substring(0, 50) + '...'
      })));
    }

    // Send email via Resend using your verified domain
    const emailResult = await resend.emails.send({
      from: 'Weekly Duty Coverage <duty@erisync.xyz>',
      to: template.distribution_list,
      subject: `Weekly Duty Coverage - Week ${week_number}, ${year}`,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('Email sent:', emailResult);
    console.log('Attachments count:', attachments.length);

    // Log email history
    await supabaseServiceRole.from('weekly_email_history').insert({
      template_id,
      week_number,
      year,
      sent_by: user.id,
      recipient_count: template.distribution_list.length,
      status: emailResult.error ? 'failed' : 'success',
    });

    return new Response(
      JSON.stringify({ success: true, data: emailResult }),
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

// Combine manual assignments with schedule-based assignments
function getCombinedAssignments(
  manualAssignments: any[],
  scheduleEntries: any[],
  template: any,
  startDate: Date,
  endDate: Date
): Assignment[] {
  const combined: Assignment[] = [];
  const manualMap = new Map<string, any[]>();

  // Index manual assignments by key (date + team_id + duty_type)
  // Store as arrays to handle multiple assignments for same date/team/duty
  manualAssignments.forEach(assignment => {
    const key = `${assignment.date}_${assignment.team_id}_${assignment.duty_type}`;
    if (!manualMap.has(key)) {
      manualMap.set(key, []);
    }
    manualMap.get(key)!.push(assignment);
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
          const manualAssignments = manualMap.get(key)!;
          manualAssignments.forEach(manual => {
            if (manual.user_id) { // Only include if user_id is not null
              combined.push({
                ...manual,
                source: 'manual'
              });
            }
          });
        } else {
          // Auto-pull from schedule - get ALL matching users
          const scheduleEntriesForDate = scheduleEntries.filter(
            e => e.date === dateStr && e.team_id === teamId
          );
          scheduleEntriesForDate.forEach(scheduleEntry => {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'weekend',
              source: 'schedule'
            } as Assignment);
          });
        }
      }

      // Check lateshift
      if (template.include_lateshift) {
        const key = `${dateStr}_${teamId}_lateshift`;
        if (manualMap.has(key)) {
          const manualAssignments = manualMap.get(key)!;
          manualAssignments.forEach(manual => {
            if (manual.user_id) { // Only include if user_id is not null
              combined.push({
                ...manual,
                source: 'manual'
              });
            }
          });
        } else {
          // Auto-pull from schedule - get ALL matching users
          const scheduleEntriesForDate = scheduleEntries.filter(
            e => e.date === dateStr && e.team_id === teamId && e.shift_type === 'late'
          );
          scheduleEntriesForDate.forEach(scheduleEntry => {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'lateshift',
              source: 'schedule'
            } as Assignment);
          });
        }
      }

      // Check earlyshift
      if (template.include_earlyshift) {
        const key = `${dateStr}_${teamId}_earlyshift`;
        if (manualMap.has(key)) {
          const manualAssignments = manualMap.get(key)!;
          manualAssignments.forEach(manual => {
            if (manual.user_id) { // Only include if user_id is not null
              combined.push({
                ...manual,
                source: 'manual'
              });
            }
          });
        } else {
          // Auto-pull from schedule - get ALL matching users
          const scheduleEntriesForDate = scheduleEntries.filter(
            e => e.date === dateStr && e.team_id === teamId && e.shift_type === 'early'
          );
          scheduleEntriesForDate.forEach(scheduleEntry => {
            combined.push({
              user_id: scheduleEntry.user_id,
              user: scheduleEntry.user,
              team_id: teamId,
              date: dateStr,
              duty_type: 'earlyshift',
              source: 'schedule'
            } as Assignment);
          });
        }
      }
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return combined;
}

// Helper function for formatting names without country codes
const formatNameForEmail = (profile: any): string => {
  if (!profile) return 'TBD';
  const name = profile.initials || profile.first_name || 'Unknown';
  // Strip any country codes in format (XX) from the name
  return name.replace(/\s*\([A-Z]{2}\)\s*/g, '').trim();
};

// Consolidate teams by category (e.g., all "Central" teams into one)
function consolidateTeams(teams: TeamData[]): ConsolidatedTeam[] {
  const consolidated: ConsolidatedTeam[] = [];
  
  // Find all teams with "Central" or "Turbine Troubleshooting Central" in their name
  const centralTeams = teams.filter(t => {
    const lowerName = t.name.toLowerCase();
    return lowerName.includes('central') || lowerName.includes('turbine troubleshooting central');
  });
  
  if (centralTeams.length > 0) {
    consolidated.push({
      displayName: 'Central',
      teamIds: centralTeams.map(t => t.id),
      category: 'central'
    });
  }
  
  // Add non-Central teams individually if needed
  const otherTeams = teams.filter(t => {
    const lowerName = t.name.toLowerCase();
    return !lowerName.includes('central') && !lowerName.includes('turbine troubleshooting central');
  });
  
  otherTeams.forEach(team => {
    consolidated.push({
      displayName: team.name,
      teamIds: [team.id],
      category: team.id
    });
  });
  
  return consolidated;
}

// Build the HTML email content with multi-team support
function buildDutyCoverageEmail(
  template: any,
  assignments: Assignment[],
  teams: TeamData[],
  shiftDefs: any[]
): string {
  const getShiftTimes = (shiftType: string) => {
    const def = shiftDefs.find(d => d.shift_type === shiftType);
    if (def) {
      return ` (${def.start_time.substring(0, 5)}-${def.end_time.substring(0, 5)})`;
    }
    // Fallback to default times if no definition found
    const defaults: Record<string, string> = {
      weekend: ' (08:00-16:00)',
      late: ' (14:00-22:00)',
      early: ' (06:00-14:00)'
    };
    return defaults[shiftType] || '';
  };
  
  const weekendDuty = assignments.filter(a => a.duty_type === 'weekend');
  const lateshiftDuty = assignments.filter(a => a.duty_type === 'lateshift');
  const earlyshiftDuty = assignments.filter(a => a.duty_type === 'earlyshift');

  // Consolidate teams by category
  const consolidatedTeams = consolidateTeams(teams);

  // Helper to build duty section with consolidated teams (Name + Region columns)
  const buildDutySection = (title: string, dutyAssignments: Assignment[]) => {
    if (dutyAssignments.length === 0) return '';

    // Group by date, then by consolidated team category
    const byDate: Record<string, Record<string, Assignment[]>> = {};
    dutyAssignments.forEach(assignment => {
      const date = assignment.date!;
      if (!byDate[date]) byDate[date] = {};
      
      // Find which consolidated team this assignment belongs to
      const consolidated = consolidatedTeams.find(ct => ct.teamIds.includes(assignment.team_id));
      const category = consolidated?.category || assignment.team_id;
      
      if (!byDate[date][category]) byDate[date][category] = [];
      byDate[date][category].push(assignment);
    });

    const days = Object.keys(byDate).sort();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Create header with Name and Region columns for each consolidated team
    const headerCells = consolidatedTeams.map(consolidated => `
      <th colspan="2" style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; background: #f3f4f6;">${consolidated.displayName}</th>
    `).join('');

    const subHeaderCells = consolidatedTeams.map(() => `
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; font-size: 12px;">Name</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; font-size: 12px;">Responsible Region</th>
    `).join('');

    const rows = days.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00Z');
      const dayName = dayNames[date.getUTCDay()];
      
      // Create name and region cells for each consolidated team
      const teamCells = consolidatedTeams.map(consolidated => {
        const teamAssignments = byDate[dateStr][consolidated.category] || [];
        
        if (teamAssignments.length === 0) {
          return `
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
          `;
        }
        
        // Separate names and regions into individual columns
        const nameRows = teamAssignments.map(assignment => {
          const name = assignment.user ? formatNameForEmail(assignment.user) : 'TBD';
          const sourceIndicator = assignment.source === 'schedule' ? '📅 ' : '';
          return `${sourceIndicator}${name}`;
        }).join('<br/>');

        const regionRows = teamAssignments.map(assignment => {
          return assignment.responsibility_region || '-';
        }).join('<br/>');

        return `
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${nameRows}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${regionRows}</td>
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
              <th rowspan="2" style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; vertical-align: middle;">Date</th>
              <th rowspan="2" style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; vertical-align: middle;">Weekday</th>
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

  const weekendSection = template.include_weekend_duty ? buildDutySection(`Weekend/Public holiday duty${getShiftTimes('weekend')}`, weekendDuty) : '';
  const lateshiftSection = template.include_lateshift ? buildDutySection(`Late Shift Central${getShiftTimes('late')}`, lateshiftDuty) : '';
  const earlyshiftSection = template.include_earlyshift ? buildDutySection(`Early Shift Central${getShiftTimes('early')}`, earlyshiftDuty) : '';

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
    </div>
  </div>
</body>
</html>`;
}
