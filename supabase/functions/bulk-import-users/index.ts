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
        // Use a standard password for all users
        const standardPassword = "VestasTemp2025!"
        
        // Create auth user without email confirmation
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: standardPassword,
          email_confirm: true, // Skip email confirmation
          user_metadata: {
            employee_id: userData.employeeId,
            bulk_imported: true,
            requires_password_change: true // Flag for mandatory password change
          }
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            // User exists, get their ID
            const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
            const user = existingUser.users.find(u => u.email === userData.email)
            
            if (user) {
              // Update profile if it exists
              const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                  user_id: user.id,
                  email: userData.email,
                  first_name: userData.employeeId || userData.email.split('@')[0],
                  last_name: '',
                  country_code: 'US'
                })

              if (profileError) {
                results.users.errors.push(`Profile for ${userData.email}: ${profileError.message}`)
              } else {
                results.users.updated++
              }

              // Handle roles and team membership for existing user
              await assignUserRole(supabaseAdmin, user.id, userData, results, teamManagerMap)
            } else {
              results.users.errors.push(`Could not find existing user: ${userData.email}`)
            }
          } else {
            results.users.errors.push(`Auth error for ${userData.email}: ${authError.message}`)
          }
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
            requires_password_change: true // Flag for mandatory password change
          })

        if (profileError) {
          results.users.errors.push(`Profile for ${userData.email}: ${profileError.message}`)
        } else {
          results.users.created++
          console.log(`Created user: ${userData.email}`)
        }

        // Handle roles and team membership
        await assignUserRole(supabaseAdmin, authUser.user.id, userData, results, teamManagerMap)

      } catch (error) {
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
    // Map role names to our enum values
    const roleMapping: Record<string, string> = {
      'Planner': 'planner',
      'Manager': 'manager',
      'Team Member': 'teammember'
    }

    const role = roleMapping[userData.role] || 'teammember'

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role
      })

    if (roleError && !roleError.message.includes('duplicate')) {
      results.roles.errors.push(`Role for ${userData.email}: ${roleError.message}`)
    } else if (!roleError) {
      results.roles.created++
    }

    // Assign to team if provided
    if (userData.teamId || userData.teamName) {
      let teamId = userData.teamId

      // If we have teamName but no teamId, look up the team
      if (!teamId && userData.teamName) {
        const { data: team } = await supabaseAdmin
          .from('teams')
          .select('id')
          .eq('name', userData.teamName)
          .single()
        
        teamId = team?.id
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
          .insert({
            user_id: userId,
            team_id: teamId,
            is_manager: isManager
          })

        if (teamMemberError && !teamMemberError.message.includes('duplicate')) {
          results.teamMembers.errors.push(`Team membership for ${userData.email}: ${teamMemberError.message}`)
        } else if (!teamMemberError) {
          results.teamMembers.created++
        }
      }
    }
  } catch (error) {
    results.roles.errors.push(`Role assignment for ${userData.email}: ${error.message}`)
  }
}