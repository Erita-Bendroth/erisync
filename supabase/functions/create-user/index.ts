import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid JWT token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if user has admin or planner role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !userRoles?.some(r => r.role === 'admin' || r.role === 'planner')) {
      return new Response(JSON.stringify({ error: 'Admin or planner access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Admin/Planner ${user.email} is creating new user`);

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

    const { email, password, firstName, lastName, role, countryCode, teamId, requiresPasswordChange, sendEmail, initials } = await req.json();

    // Validate input - support both firstName/lastName and initials
    const userFirstName = firstName || (initials ? initials.split(' ')[0] || initials : '');
    const userLastName = lastName || (initials ? initials.split(' ')[1] || '' : '');
    
    if (!email || !password || !userFirstName || !role) {
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
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: userFirstName,
        last_name: userLastName
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

    const createdUser = userData.user;
    if (!createdUser) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: createdUser.id,
        first_name: userFirstName,
        last_name: userLastName,
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
        user_id: createdUser.id,
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
          user_id: createdUser.id,
          team_id: teamId,
          is_manager: role === 'manager'
        });

      if (teamError) {
        console.error('Team assignment error:', teamError);
      }
    }

    // Send welcome email if requested
    if (sendEmail) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: 'Schedule System <onboarding@resend.dev>',
              to: [email],
              subject: 'Welcome to Schedule System',
              html: `
                <h1>Welcome to Schedule System!</h1>
                <p>Hello ${userFirstName} ${userLastName},</p>
                <p>Your account has been created successfully. Here are your login details:</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> ${tempPassword}</p>
                <p><strong>Important:</strong> You will be required to change your password on first login for security purposes.</p>
                <p>Please keep this information secure and do not share it with anyone.</p>
                <br>
                <p>Best regards,<br>The Schedule System Team</p>
              `
            })
          });

          if (!resendResponse.ok) {
            console.error('Failed to send welcome email:', await resendResponse.text());
          } else {
            console.log('Welcome email sent successfully to:', email);
          }
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Don't fail user creation if email fails
        }
      } else {
        console.warn('RESEND_API_KEY not configured, skipping email notification');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: createdUser,
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