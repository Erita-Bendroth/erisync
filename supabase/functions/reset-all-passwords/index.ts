import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a secure random password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

interface ResetAllPasswordsRequest {
  adminUserId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Reset all passwords function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create Supabase client with the user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid JWT token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    console.log('Admin user requesting bulk password reset:', user.id);

    // Verify the requesting user has admin privileges using the authenticated client
    const { data: adminRoles, error: adminCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (adminCheckError) {
      console.error('Error checking admin privileges:', adminCheckError);
      return new Response(JSON.stringify({ error: 'Failed to verify admin privileges' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const hasAdminRole = adminRoles?.some(r => r.role === 'admin');
    if (!hasAdminRole) {
      console.error('User does not have admin privileges:', user.id);
      return new Response(JSON.stringify({ error: 'Insufficient privileges. Admin role required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get all user profiles to get their user_ids
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, first_name, last_name');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      throw new Error('Failed to fetch user profiles');
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users found to reset passwords');
      return new Response(JSON.stringify({ 
        message: 'No users found',
        resetCount: 0 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Found ${profiles.length} users to reset passwords`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Reset password for each user with unique secure passwords
    for (const profile of profiles) {
      try {
        console.log(`Resetting password for user: ${profile.email} (${profile.user_id})`);
        
        // Generate a unique secure password for each user
        const newPassword = generateSecurePassword();
        
        // Update the user's password using admin API
        const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          profile.user_id,
          { 
            password: newPassword,
            user_metadata: {
              ...profile,
              requires_password_change: true
            }
          }
        );

        if (updateError) {
          console.error(`Failed to update password for ${profile.email}:`, updateError);
          errors.push(`${profile.email}: ${updateError.message}`);
          errorCount++;
          continue;
        }

        // Update the profile to mark password change required
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ requires_password_change: true })
          .eq('user_id', profile.user_id);

        if (profileUpdateError) {
          console.error(`Failed to update profile for ${profile.email}:`, profileUpdateError);
          // Don't count this as a failure since password was updated
        }

        console.log(`Successfully reset password for: ${profile.email}`);
        successCount++;

      } catch (error: any) {
        console.error(`Error processing user ${profile.email}:`, error);
        errors.push(`${profile.email}: ${error.message}`);
        errorCount++;
      }
    }

    const response = {
      message: `Bulk password reset completed`,
      totalUsers: profiles.length,
      successCount,
      errorCount,
      requiresPasswordChange: true,
      note: 'Individual secure passwords were generated for each user',
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Bulk password reset summary:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in reset-all-passwords function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to reset passwords',
        details: 'Check function logs for more information'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);