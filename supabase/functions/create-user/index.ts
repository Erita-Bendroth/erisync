import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate secure random password with complexity requirements
function generateSecurePassword(): string {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { email, password, firstName, lastName, role, countryCode, teamId, requiresPasswordChange } = await req.json();

    // Validate input
    if (!email || !password || !firstName || !lastName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate secure random temporary password
    const tempPassword = generateSecurePassword();
    
    // Create user
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (createError) {
      console.error('User creation error:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: user.user!.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        country_code: countryCode || 'US',
        requires_password_change: true // Always require password change for new users
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: user.user!.id,
        role: role
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
    }

    // Assign to team if teamId is provided and not "no-team"
    if (teamId && teamId !== "no-team") {
      const { error: teamError } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id: user.user!.id,
          team_id: teamId,
          is_manager: role === 'manager'
        });

      if (teamError) {
        console.error('Team assignment error:', teamError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: user.user,
        message: 'User created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})