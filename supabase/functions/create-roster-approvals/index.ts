import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("create-roster-approvals: Function invoked");
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("create-roster-approvals: No authorization header");
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user client to verify the requesting user
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('create-roster-approvals: User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { rosterId, teamIds } = body;
    
    console.log(`create-roster-approvals: Processing - rosterId: ${rosterId}, teamIds: ${JSON.stringify(teamIds)}, user: ${user.id}`);
    
    if (!rosterId || !teamIds || !Array.isArray(teamIds)) {
      console.error("create-roster-approvals: Missing required fields");
      return new Response(JSON.stringify({ error: 'Missing rosterId or teamIds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is a manager of one of the teams or is admin/planner
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error("create-roster-approvals: Error fetching roles:", rolesError);
    }

    const isAdminOrPlanner = userRoles?.some(r => r.role === 'admin' || r.role === 'planner');
    console.log(`create-roster-approvals: User isAdminOrPlanner: ${isAdminOrPlanner}`);

    if (!isAdminOrPlanner) {
      // Check if user is a manager of any of the teams
      const { data: managedTeams, error: managedError } = await supabaseAdmin
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('is_manager', true)
        .in('team_id', teamIds);

      if (managedError) {
        console.error("create-roster-approvals: Error checking managed teams:", managedError);
      }

      if (!managedTeams || managedTeams.length === 0) {
        console.error('create-roster-approvals: User not authorized - not a team manager');
        return new Response(JSON.stringify({ error: 'Not authorized - must be team manager, admin, or planner' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`create-roster-approvals: User manages teams: ${managedTeams.map(t => t.team_id).join(', ')}`);
    }

    // Get managers for all teams
    const { data: teamManagers, error: managersError } = await supabaseAdmin
      .from('team_members')
      .select('user_id, team_id')
      .in('team_id', teamIds)
      .eq('is_manager', true);

    if (managersError) {
      console.error('create-roster-approvals: Error fetching team managers:', managersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch team managers', details: managersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`create-roster-approvals: Found ${teamManagers?.length || 0} managers for ${teamIds.length} teams`);

    if (!teamManagers || teamManagers.length === 0) {
      console.error('create-roster-approvals: No managers found for teams');
      return new Response(JSON.stringify({ error: 'No managers found for teams' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create approval records for each team-manager pair
    const approvalRecords = teamManagers.map(tm => ({
      roster_id: rosterId,
      team_id: tm.team_id,
      manager_id: tm.user_id,
      approved: tm.user_id === user.id, // Auto-approve for submitting user
      approved_at: tm.user_id === user.id ? new Date().toISOString() : null,
      comments: tm.user_id === user.id ? 'Auto-approved on submission' : null,
    }));

    console.log(`create-roster-approvals: Creating ${approvalRecords.length} approval records`);
    console.log(`create-roster-approvals: Records to insert:`, JSON.stringify(approvalRecords));

    // Use upsert to handle existing records
    const { data: insertedApprovals, error: insertError } = await supabaseAdmin
      .from('roster_manager_approvals')
      .upsert(approvalRecords, {
        onConflict: 'roster_id,team_id,manager_id',
        ignoreDuplicates: false,
      })
      .select();

    if (insertError) {
      console.error('create-roster-approvals: Error creating approval records:', insertError);
      console.error('create-roster-approvals: Error details:', JSON.stringify(insertError));
      return new Response(JSON.stringify({ error: 'Failed to create approval records', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`create-roster-approvals: Successfully created ${insertedApprovals?.length || 0} approval records`);

    // Update roster status to pending_approval and track submitter
    const { error: rosterUpdateError } = await supabaseAdmin
      .from('partnership_rotation_rosters')
      .update({ 
        status: 'pending_approval', 
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', rosterId);

    if (rosterUpdateError) {
      console.error('create-roster-approvals: Error updating roster status:', rosterUpdateError);
      // Don't fail the whole request, approvals were created
    } else {
      console.log('create-roster-approvals: Roster status updated to pending_approval');
    }

    // Log the submission activity
    const { error: activityError } = await supabaseAdmin
      .from('roster_activity_log')
      .insert({
        roster_id: rosterId,
        user_id: user.id,
        action: 'submitted',
        details: { team_count: teamIds.length, approval_count: insertedApprovals?.length || 0 },
      });

    if (activityError) {
      console.error('create-roster-approvals: Error logging activity:', activityError);
    } else {
      console.log('create-roster-approvals: Activity logged successfully');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      approvalsCreated: insertedApprovals?.length || 0,
      autoApprovedFor: user.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('create-roster-approvals: Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
