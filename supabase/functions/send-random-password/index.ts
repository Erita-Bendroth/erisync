import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const secureRandomInt = (max: number): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};
const generateRandomPassword = (): string => {
  const length = 12;
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const charset = lowercase + uppercase + numbers + symbols;

  const chars: string[] = [
    lowercase.charAt(secureRandomInt(lowercase.length)),
    uppercase.charAt(secureRandomInt(uppercase.length)),
    numbers.charAt(secureRandomInt(numbers.length)),
    symbols.charAt(secureRandomInt(symbols.length)),
  ];
  for (let i = 4; i < length; i++) {
    chars.push(charset.charAt(secureRandomInt(charset.length)));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with the user's token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify the user is authenticated and has admin role
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      console.error('Authorization error: User does not have admin role');
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const { userId, userEmail } = await req.json();

    if (!userId || !userEmail) {
      throw new Error('User ID and email are required');
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

    // Generate random password
    const newPassword = generateRandomPassword();
    console.log('Generated new password for user:', userId);

    // Update user password using admin client
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (passwordError) {
      console.error('Error updating password:', passwordError);
      throw passwordError;
    }

    // Update profile to remove password change requirement
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ requires_password_change: false })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Initialize Resend if API key is available
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Send email with new password
      const { error: emailError } = await resend.emails.send({
        from: "EriSync <noreply@erisync.xyz>",
        to: [userEmail],
        subject: "Your New EriSync Password",
        html: `
          <h1>Your New Password for EriSync.com</h1>
          <p>You have been assigned a new password for EriSync.com</p>
          <p><strong>Username:</strong> ${userEmail}</p>
          <p><strong>New Password:</strong> <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${newPassword}</code></p>
          <p>Please log in with these credentials and consider changing your password after logging in.</p>
          <br>
          <p>Best regards,<br>The EriSync Team</p>
        `,
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        // Don't throw here - password was updated successfully
      } else {
        console.log('Email sent successfully to:', userEmail);
      }
    } else {
      console.log('RESEND_API_KEY not configured, skipping email');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        emailSent: !!resendApiKey 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-random-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to update password',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});