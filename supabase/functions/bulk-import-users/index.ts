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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
    const teamManagerMap = new Map<string, string>() // teamName -> managerEmail
    
    if (teams && teams.length > 0) {
      for (const team of teams) {
        try {
          const { data: existingTeam } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('name', team.teamName)
            .single()

          if (!existingTeam) {
            const { error } = await supabaseAdmin
              .from('teams')
              .insert({
                name: team.teamName,
                description: `Auto-imported team: ${team.teamName}`
              })

            if (error) {
              results.teams.errors.push(`Team ${team.teamName}: ${error.message}`)
            } else {
              results.teams.created++
              console.log(`Created team: ${team.teamName}`)
            }
          } else {
            results.teams.updated++
          }

          // Track manager assignment for later
          if (team.managerEmail) {
            teamManagerMap.set(team.teamName, team.managerEmail)
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
          await assignUserRole(supabaseAdmin, existingUser.id, userData, results, teamManagerMap)
        } else {
          // Create new user
          const standardPassword = "VestasTemp2025!"
          
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: standardPassword,
            email_confirm: true,
            user_metadata: {
              employee_id: userData.employeeId,
              bulk_imported: true,
              requires_password_change: true
            }
          })

          if (authError) {
            results.users.errors.push(`Auth error for ${userData.email}: ${authError.message}`)
            continue
          }

          if (!authUser.user) {
            results.users.errors.push(`No user created for ${userData.email}`)
            continue
          }

          // Create profile
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: authUser.user.id,
              email: userData.email,
              first_name: userData.employeeId || userData.email.split('@')[0],
              last_name: '',
              country_code: 'US',
              requires_password_change: true
            })

          if (profileError) {
            results.users.errors.push(`Profile for ${userData.email}: ${profileError.message}`)
          } else {
            results.users.created++
            console.log(`Created user: ${userData.email}`)
          }

          // Handle roles and team membership
          console.log(`Calling assignUserRole for new user: ${userData.email}`)
          await assignUserRole(supabaseAdmin, authUser.user.id, userData, results, teamManagerMap)
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

async function assignUserRole(supabaseAdmin: any, userId: string, userData: UserImportData, results: any, teamManagerMap: Map<string, string>) {
  try {
    console.log(`assignUserRole called for ${userData.email}, userId: ${userId}, teamName: ${userData.teamName}, role: ${userData.role}`)
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
    if (userData.teamId || userData.teamName) {
      let teamId = userData.teamId

      // If we have teamName but no teamId, look up the team
      if (!teamId && userData.teamName) {
        console.log(`Looking up team by name: ${userData.teamName}`)
        const { data: team, error: teamLookupError } = await supabaseAdmin
          .from('teams')
          .select('id')
          .eq('name', userData.teamName)
          .single()
        
        if (teamLookupError) {
          console.error(`Error looking up team ${userData.teamName}: ${teamLookupError.message}`)
          results.teamMembers.errors.push(`Team lookup for ${userData.teamName}: ${teamLookupError.message}`)
          return
        }
        
        teamId = team?.id
        console.log(`Found team ${userData.teamName} with ID: ${teamId}`)
      }

      if (teamId) {
        // Determine if this user should be a manager of this team
        let isManager = false
        
        // Method 1: Check if their role is 'manager' AND they're designated as manager for this team
        if (role === 'manager') {
          // Check if they're designated as manager for this specific team
          const designatedManager = teamManagerMap.get(userData.teamName || '')
          if (designatedManager === userData.email) {
            isManager = true
          }
          // Also check if ManagerEmail field in user data matches current user
          else if (userData.managerEmail === userData.email) {
            isManager = true
          }
          // Fallback: if role is manager and no specific manager is designated, make them manager
          else if (!designatedManager) {
            isManager = true
          }
        }

        console.log(`Assigning ${userData.email} to team ${userData.teamName}, isManager: ${isManager}`)

        const { error: teamMemberError } = await supabaseAdmin
          .from('team_members')
          .upsert({
            user_id: userId,
            team_id: teamId,
            is_manager: isManager
          }, { 
            onConflict: 'user_id,team_id',
            ignoreDuplicates: false // Allow updates
          })

        if (teamMemberError) {
          results.teamMembers.errors.push(`Team membership for ${userData.email}: ${teamMemberError.message}`)
        } else {
          results.teamMembers.created++
          console.log(`Successfully assigned ${userData.email} to team ${userData.teamName}`)
        }
      }
    }
  } catch (error) {
    results.roles.errors.push(`Role assignment for ${userData.email}: ${error.message}`)
  }
}