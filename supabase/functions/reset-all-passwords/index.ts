import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Create Supabase admin client
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

    const { adminUserId }: ResetAllPasswordsRequest = await req.json();
    console.log('Admin user requesting bulk password reset:', adminUserId);

    // Verify the requesting user has admin privileges
    const { data: adminRoles, error: adminCheckError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId);

    if (adminCheckError) {
      console.error('Error checking admin privileges:', adminCheckError);
      throw new Error('Failed to verify admin privileges');
    }

    const hasAdminRole = adminRoles?.some(r => r.role === 'admin');
    if (!hasAdminRole) {
      console.error('User does not have admin privileges:', adminUserId);
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

    const newPassword = 'VestasTemp2025!';
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Reset password for each user
    for (const profile of profiles) {
      try {
        console.log(`Resetting password for user: ${profile.email} (${profile.user_id})`);
        
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
      newPassword: 'VestasTemp2025!',
      requiresPasswordChange: true,
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