import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Generate secure random password using crypto.getRandomValues
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
function generateSecurePassword(): string {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + symbols;

  const chars: string[] = [
    uppercase[secureRandomInt(uppercase.length)],
    lowercase[secureRandomInt(lowercase.length)],
    numbers[secureRandomInt(numbers.length)],
    symbols[secureRandomInt(symbols.length)],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(allChars[secureRandomInt(allChars.length)]);
  }
  // Fisher-Yates shuffle with secure randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Validate request method
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

    // Initialize Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Verify the user is authenticated
    const { data: { user: authenticatedUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !authenticatedUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid JWT token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if user has admin or planner role
    const { data: userRoles, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authenticatedUser.id);

    if (roleCheckError || !userRoles?.some(r => r.role === 'admin' || r.role === 'planner')) {
      return new Response(JSON.stringify({ error: 'Admin or planner access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Admin/Planner ${authenticatedUser.email} is creating new user`);

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

    const { email, password, initials, role, countryCode, teamId, requiresPasswordChange } = await req.json();

    // Validate input
    if (!email || !password || !initials || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Normalize initials server-side
    const normalizedInitials = initials.trim().toUpperCase();

    // Generate secure random temporary password
    const tempPassword = generateSecurePassword();
    
    // Create user with normalized initials in metadata
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        initials: normalizedInitials
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

    // Create/update profile using upsert to handle trigger race condition
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: newUserData.user!.id,
        first_name: normalizedInitials,
        last_name: '',
        initials: normalizedInitials,
        email: email,
        country_code: countryCode || 'US',
        requires_password_change: true
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return new Response(
        JSON.stringify({ error: `User created but profile failed: ${profileError.message}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Assign role
    const { error: roleAssignmentError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUserData.user!.id,
        role: role
      });

    if (roleAssignmentError) {
      console.error('Role assignment error:', roleAssignmentError);
      return new Response(
        JSON.stringify({ error: `User created but role assignment failed: ${roleAssignmentError.message}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Assign to team if teamId is provided and not "no-team"
    if (teamId && teamId !== "no-team") {
      const { error: teamError } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id: newUserData.user!.id,
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
        user: newUserData.user,
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