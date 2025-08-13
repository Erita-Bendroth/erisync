import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserImportData {
  employeeId?: string;
  email: string;
  role: string;
  teamId?: string;
  teamName?: string;
  managerEmail?: string;
  isActive?: boolean;
}

// Create team code mappings
const teamCodeMappings: { [key: string]: string } = {
  'TSC': 'Turbine Support Central',
  'TTCS': 'Turbine Troubleshooting Central - South',
  'TTCE': 'Turbine Troubleshooting Central - East',
  'TOpC': 'Technical Operations Central',
  'PSCN': 'Plant Support Central - North',
  'PSCS': 'Plant Support Central - South',
  'PSC': 'Plant Troubleshooting Central',
  'POC': 'Plant Operations Central',
  'TON': 'Turbine Operations North',
  'TSN': 'Turbine Support North',
  'TTNW': 'Turbine Troubleshooting North - West',
  'TTNC': 'Turbine Troubleshooting North - Central',
  'TTNE': 'Turbine Troubleshooting North - East',
  'PON': 'Plant Operations North',
  'PSN': 'Plant Support North',
  'PTN': 'Plant Troubleshooting North',
  'PCI': 'Pre-Config & Installation - NCE',
  'TOpN': 'Technical Operations North',
  'TOpOfs': 'Technical Operations Offshore',
  'TOOfs': 'Turbine Operations Offshore',
  'TSOfs': 'Turbine Support Offshore',
  'TTOfs': 'Turbine Troubleshooting Offshore',
  'POOfs': 'Plant Operations Offshore',
  'PSOfsC1': 'Plant Support Offshore - Cluster 1',
  'PFOfsC2&3': 'Plant Support Offshore - Cluster 2 & 3',
  'PTOfs': 'Plant Troubleshooting Offshore',
  'TOC': 'Turbine Operations Central'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client with RLS disabled
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: { schema: 'public' },
        auth: { persistSession: false }
      }
    )

    const { users, teams } = await req.json()

    console.log(`Starting bulk import: ${users.length} users, ${teams?.length || 0} teams`)
    console.log('Sample user data:', JSON.stringify(users[0], null, 2))
    console.log('Sample team data:', teams && teams.length > 0 ? JSON.stringify(teams[0], null, 2) : 'No teams')

    const results = {
      users: { created: 0, updated: 0, errors: [] as string[] },
      teams: { created: 0, updated: 0, errors: [] as string[] },
      roles: { created: 0, errors: [] as string[] },
      teamMembers: { created: 0, errors: [] as string[] }
    }

    // First, create/update teams and track manager assignments
    const teamManagerMap = new Map<string, string>() // teamId -> managerEmail
    const teamIdToUuidMap = new Map<string, string>() // teamId -> actual database UUID
    
    if (teams && teams.length > 0) {
      for (const team of teams) {
        try {
          const { data: existingTeam, error: existingError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('name', team.teamName)
            .single()

          let teamUuid = null
          
          if (existingError && existingError.code === 'PGRST116') {
            // Team doesn't exist, create it
            const { data: newTeam, error: createError } = await supabaseAdmin
              .from('teams')
              .insert({
                name: team.teamName,
                description: `Auto-imported team: ${team.teamName}`
              })
              .select('id')
              .single()

            if (createError) {
              results.teams.errors.push(`Team ${team.teamName}: ${createError.message}`)
              continue
            } else {
              teamUuid = newTeam.id
              results.teams.created++
              console.log(`Created team: ${team.teamName} with UUID: ${teamUuid}`)
            }
          } else if (!existingError) {
            // Team exists
            teamUuid = existingTeam.id
            results.teams.updated++
            console.log(`Found existing team: ${team.teamName} with UUID: ${teamUuid}`)
          } else {
            results.teams.errors.push(`Team lookup error for ${team.teamName}: ${existingError.message}`)
            continue
          }

          // Track mappings for later use
          if (teamUuid) {
            teamIdToUuidMap.set(team.teamId, teamUuid)
            if (team.managerEmail) {
              teamManagerMap.set(team.teamId, team.managerEmail)
            }
            console.log(`Mapped TeamID ${team.teamId} -> UUID ${teamUuid}`)
          }
        } catch (error) {
          results.teams.errors.push(`Team ${team.teamName}: ${error.message}`)
        }
      }
    }

    // Create/update users
    for (const userData of users) {
      try {
        console.log(`Processing user: ${userData.email}, teamName: ${userData.teamName}, role: ${userData.role}`)
        
        // First, check if user already exists
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (listError) {
          console.error(`Error checking existing users: ${listError.message}`)
          results.users.errors.push(`Error checking existing users: ${listError.message}`)
          continue
        }

        const existingUser = existingUsers.users.find(u => u.email === userData.email)
        
        if (existingUser) {
          // User already exists, update their profile and assignments
          console.log(`Found existing user: ${userData.email}, ID: ${existingUser.id}`)
          
          // Update profile
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              user_id: existingUser.id,
              email: userData.email,
              first_name: userData.employeeId || userData.email.split('@')[0],
              last_name: '',
              country_code: 'US',
              requires_password_change: true
            }, { 
              onConflict: 'user_id' 
            })

          if (profileError) {
            console.error(`Profile update error for ${userData.email}: ${profileError.message}`)
            results.users.errors.push(`Profile update for ${userData.email}: ${profileError.message}`)
          } else {
            results.users.updated++
            console.log(`Updated profile for: ${userData.email}`)
          }

          // Handle roles and team membership for existing user
          console.log(`Calling assignUserRole for existing user: ${userData.email}`)
          await assignUserRole(supabaseAdmin, existingUser.id, userData, results, teamManagerMap, teamIdToUuidMap)
        } else {
          // Skip creating new users - only update existing ones
          console.log(`Skipping user creation for ${userData.email} - user does not exist`)
          results.users.errors.push(`User ${userData.email} does not exist in the system - skipping`)
          continue
        }

      } catch (error) {
        console.error(`Error processing user ${userData.email}:`, error)
        results.users.errors.push(`${userData.email}: ${error.message}`)
      }
    }

    console.log('Import completed:', results)

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          totalUsersProcessed: users.length,
          usersCreated: results.users.created,
          usersUpdated: results.users.updated,
          teamsCreated: results.teams.created,
          rolesAssigned: results.roles.created,
          teamMembersAdded: results.teamMembers.created,
          totalErrors: results.users.errors.length + results.teams.errors.length + results.roles.errors.length + results.teamMembers.errors.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Bulk import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function assignUserRole(supabaseAdmin: any, userId: string, userData: UserImportData, results: any, teamManagerMap: Map<string, string>, teamIdToUuidMap: Map<string, string>) {
  try {
    console.log(`assignUserRole called for ${userData.email}, userId: ${userId}, teamId: ${userData.teamId}, role: ${userData.role}`)
    
    // Map role names to our enum values
    const roleMapping: Record<string, string> = {
      'Planner': 'planner',
      'Manager': 'manager',
      'Team Member': 'teammember'
    }

    const role = roleMapping[userData.role] || 'teammember'

    // Assign role (use upsert to handle duplicates)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role
      }, { 
        onConflict: 'user_id,role',
        ignoreDuplicates: true 
      })

    if (roleError && !roleError.message.includes('duplicate')) {
      results.roles.errors.push(`Role for ${userData.email}: ${roleError.message}`)
    } else if (!roleError) {
      results.roles.created++
      console.log(`Assigned role ${role} to ${userData.email}`)
    }

    // Assign to team if provided
    if (userData.teamId) {
      // First, try to map team code to team name
      const fullTeamName = teamCodeMappings[userData.teamId] || userData.teamId;
      console.log(`Mapping team code ${userData.teamId} -> ${fullTeamName}`);
      
      // Look up the team by full name to get its UUID
      const { data: teamData, error: teamLookupError } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('name', fullTeamName)
        .single();
      
      if (teamLookupError || !teamData) {
        console.error(`Could not find team with name: ${fullTeamName} (from code: ${userData.teamId})`);
        results.teamMembers.errors.push(`Team not found for ${userData.email}: ${fullTeamName} (code: ${userData.teamId})`);
        return;
      }

      const actualTeamUuid = teamData.id;
      console.log(`Found team UUID ${actualTeamUuid} for team name ${fullTeamName} (code: ${userData.teamId})`);

      // Determine if this user should be a manager of this team
      let isManager = false
      
      // Check if their role is 'manager' AND they're designated as manager for this team
      if (role === 'manager') {
        // Check if they're designated as manager for this specific team using teamId
        const designatedManager = teamManagerMap.get(userData.teamId)
        if (designatedManager === userData.email) {
          isManager = true
          console.log(`${userData.email} is designated manager for team ${userData.teamId}`)
        }
        // Also check if ManagerEmail field in user data matches current user
        else if (userData.managerEmail === userData.email) {
          isManager = true
          console.log(`${userData.email} is self-designated manager`)
        }
        // Fallback: if role is manager and no specific manager is designated, make them manager
        else if (!designatedManager) {
          isManager = true
          console.log(`${userData.email} is default manager (no designated manager)`)
        }
      }

      console.log(`Assigning ${userData.email} to team UUID ${actualTeamUuid}, isManager: ${isManager}`)

      const { error: teamMemberError } = await supabaseAdmin
        .from('team_members')
        .upsert({
          user_id: userId,
          team_id: actualTeamUuid,
          is_manager: isManager
        }, { 
          onConflict: 'user_id,team_id',
          ignoreDuplicates: false // Allow updates
        })

      if (teamMemberError) {
        console.error(`Team membership error for ${userData.email}:`, teamMemberError)
        results.teamMembers.errors.push(`Team membership for ${userData.email}: ${teamMemberError.message}`)
      } else {
        results.teamMembers.created++
        console.log(`Successfully assigned ${userData.email} to team`)
      }
    } else {
      console.log(`No teamId provided for ${userData.email}, skipping team assignment`)
    }
  } catch (error) {
    console.error(`Role assignment error for ${userData.email}:`, error)
    results.roles.errors.push(`Role assignment for ${userData.email}: ${error.message}`)
  }
}