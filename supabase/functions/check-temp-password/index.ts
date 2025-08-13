import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    
    console.log('Checking temporary password for email:', email);
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if the provided password is the temporary password
    const tempPassword = 'VestasTemp2025!';
    const hasTemporaryPassword = password === tempPassword;
    
    console.log('Password check result:', { hasTemporaryPassword });

    if (hasTemporaryPassword) {
      // Try to sign in with the temporary password to verify it's valid
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      console.log('Auth verification result:', { authData: !!authData.user, authError });

      if (authError) {
        // Password doesn't match or user doesn't exist
        return new Response(
          JSON.stringify({ hasTemporaryPassword: false }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Update the user's profile to require password change
      if (authData.user) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ requires_password_change: true })
          .eq('user_id', authData.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log('Successfully marked user for password change');
        }
      }

      // Sign out the admin session
      await supabaseAdmin.auth.signOut();
    }

    return new Response(
      JSON.stringify({ hasTemporaryPassword }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in check-temp-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});