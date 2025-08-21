import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, tempPassword } = await req.json();

    if (!userId || !tempPassword) {
      throw new Error('User ID and temporary password are required');
    }

    // Validate password strength
    if (tempPassword.length < 8) {
      throw new Error('Temporary password must be at least 8 characters long');
    }

    // Initialize Supabase Admin client
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

    console.log('Setting temporary password for user:', userId);

    // Update user password using admin client
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (passwordError) {
      console.error('Error updating password:', passwordError);
      throw passwordError;
    }

    // Set profile to require password change
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ requires_password_change: true })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('Temporary password set successfully for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Temporary password set successfully. User will be required to change it on next login.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in set-temp-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to set temporary password',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});